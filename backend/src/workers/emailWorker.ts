import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient, RecipientStatus, CampaignStatus } from '@prisma/client';
import { sendMail } from '../services/emailService';
import { personalizeEmail } from '../services/personalizationService';
import path from 'path';
import { sseManager } from '../utils/sse';

const prisma = new PrismaClient();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function createRedisConnection() {
  return new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
}

export const emailQueue = new Queue('email-sending', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 1, // We handle retries manually
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});

export interface EmailJobData {
  recipientId: string;
  campaignId: string;
  isFollowUp?: boolean;
}

let worker: Worker | null = null;

export function startWorker(): void {
  if (worker) return;

  worker = new Worker<EmailJobData>(
    'email-sending',
    async (job: Job<EmailJobData>) => {
      const { recipientId, campaignId, isFollowUp } = job.data;

      // Check if campaign is still active
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
      });

      if (!campaign || campaign.status === CampaignStatus.STOPPED) {
        if (!isFollowUp) {
          await prisma.recipient.update({
            where: { id: recipientId },
            data: { status: RecipientStatus.CANCELLED },
          });
        }
        return;
      }

      if (campaign.status === CampaignStatus.PAUSED) {
        throw new Error('PAUSED');
      }

      // Load recipient
      const recipient = await prisma.recipient.findUnique({ where: { id: recipientId } });
      if (!recipient) return;

      // If this is a follow-up job, check if recipient has already opened/interacted
      if (isFollowUp) {
        if (recipient.openCount > 0) {
          console.log(`[Follow-Up Skipped] Recipient ${recipient.email} already opened original email.`);
          return;
        }
      } else {
        if (recipient.status === RecipientStatus.SENT) return;

        // Mark as SENDING
        await prisma.recipient.update({
          where: { id: recipientId },
          data: { status: RecipientStatus.SENDING },
        });
      }

      // Emit SSE event
      sseManager.emit(campaignId, {
        type: isFollowUp ? 'sending_followup' : 'sending',
        recipientId,
        email: recipient.email,
      });

      // Get sender settings from user
      const settings = await prisma.settings.findUnique({ where: { userId: campaign.userId } });
      const sender = {
        senderName: settings?.senderName || process.env.SMTP_FROM_NAME || '',
        senderEmail: settings?.senderEmail || process.env.SMTP_FROM_EMAIL || '',
        phone: settings?.phone || '',
        linkedin: settings?.linkedin || '',
        portfolio: settings?.portfolio || '',
      };

      // Select Subject & Body depending on whether this is follow-up
      const rawSubject = isFollowUp
        ? (campaign.followUpSubject || `Re: ${campaign.subject}`)
        : campaign.subject;
      const rawBody = isFollowUp
        ? (campaign.followUpBody || campaign.body)
        : campaign.body;

      // Personalize email
      const { subject, html: rawHtml } = personalizeEmail(rawSubject, rawBody, {
        name: recipient.name || '',
        email: recipient.email,
        company: recipient.company || '',
        jobTitle: recipient.jobTitle || '',
        phone: recipient.phone || '',
        linkedin: recipient.linkedin || '',
      }, sender);

      // Inject open tracking pixel & link click tracking
      const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const trackedHtml = rawHtml.replace(/<a\s+(?:[^>]*?\s+)?href=["'](https?:\/\/[^"']+)["']/gi, (match, url) => {
        const trackingUrl = `${apiUrl}/api/track/click/${recipientId}?url=${encodeURIComponent(url)}`;
        return match.replace(url, trackingUrl);
      });
      const trackingPixel = `<img src="${apiUrl}/api/track/open/${recipientId}.png" width="1" height="1" alt="" style="display:none;width:1px;height:1px;" />`;
      const html = trackedHtml.includes('</body>')
        ? trackedHtml.replace('</body>', `${trackingPixel}</body>`)
        : trackedHtml + trackingPixel;

      // Build attachments (only for initial email or if available)
      const attachments: any[] = [];
      if (!isFollowUp && campaign.attachmentPath && campaign.attachmentName) {
        attachments.push({
          filename: campaign.attachmentName,
          path: campaign.attachmentPath,
        });
      }

      // Check for custom active SMTP accounts (Multi-SMTP Account Rotation)
      const activeSmtpAccounts = await prisma.smtpAccount.findMany({
        where: { userId: campaign.userId, isActive: true },
      });

      let selectedSmtpAccount = null;
      if (activeSmtpAccounts.length > 0) {
        // Round-robin selection based on total recipient index/timestamp
        const availableAccounts = activeSmtpAccounts.filter(acc => acc.sentToday < acc.dailyLimit);
        if (availableAccounts.length > 0) {
          const randomIndex = Math.floor(Math.random() * availableAccounts.length);
          selectedSmtpAccount = availableAccounts[randomIndex];
        }
      }

      try {
        await sendMail({
          to: recipient.email,
          subject,
          html,
          attachments,
          smtpAccount: selectedSmtpAccount
            ? {
                host: selectedSmtpAccount.host,
                port: selectedSmtpAccount.port,
                secure: selectedSmtpAccount.secure,
                username: selectedSmtpAccount.username,
                password: selectedSmtpAccount.password,
                fromEmail: selectedSmtpAccount.fromEmail,
                fromName: selectedSmtpAccount.fromName || sender.senderName,
              }
            : undefined,
        });

        if (selectedSmtpAccount) {
          await prisma.smtpAccount.update({
            where: { id: selectedSmtpAccount.id },
            data: { sentToday: { increment: 1 } },
          });
        }

        if (!isFollowUp) {
          await prisma.recipient.update({
            where: { id: recipientId },
            data: {
              status: RecipientStatus.SENT,
              sentAt: new Date(),
              errorMessage: null,
            },
          });

          await prisma.emailLog.create({
            data: { recipientId, campaignId, status: 'SENT' },
          });

          await prisma.campaign.update({
            where: { id: campaignId },
            data: {
              sentCount: { increment: 1 },
              pendingCount: { decrement: 1 },
            },
          });

          // Schedule follow-up job if enabled
          if (campaign.enableFollowUp && campaign.followUpBody) {
            const delayMs = (campaign.followUpDays || 3) * 24 * 60 * 60 * 1000;
            await emailQueue.add(
              'send-followup',
              { recipientId, campaignId, isFollowUp: true },
              { delay: delayMs }
            );
            console.log(`[Follow-Up Scheduled] For recipient ${recipient.email} in ${campaign.followUpDays} days`);
          }
        } else {
          await prisma.emailLog.create({
            data: { recipientId, campaignId, status: 'FOLLOWUP_SENT' },
          });
        }

        sseManager.emit(campaignId, { type: isFollowUp ? 'followup_sent' : 'sent', recipientId, email: recipient.email });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';

        // Health Shield: Deactivate failing SMTP account to protect queue
        if (selectedSmtpAccount && /auth|login|invalid|connect|eauth/i.test(errorMessage)) {
          console.warn(`[Health Shield] Auto-deactivating SMTP account "${selectedSmtpAccount.name}" due to error: ${errorMessage}`);
          await prisma.smtpAccount.update({
            where: { id: selectedSmtpAccount.id },
            data: { isActive: false },
          }).catch(() => {});
        }

        await prisma.recipient.update({
          where: { id: recipientId },
          data: {
            status: RecipientStatus.FAILED,
            errorMessage,
            retryCount: { increment: 1 },
          },
        });

        await prisma.emailLog.create({
          data: { recipientId, campaignId, status: 'FAILED', error: errorMessage },
        });

        await prisma.campaign.update({
          where: { id: campaignId },
          data: {
            failedCount: { increment: 1 },
            pendingCount: { decrement: 1 },
          },
        });

        sseManager.emit(campaignId, {
          type: 'failed',
          recipientId,
          email: recipient.email,
          error: errorMessage,
        });
      }

      // Check if campaign is complete
      const updated = await prisma.campaign.findUnique({ where: { id: campaignId } });
      if (updated && updated.pendingCount <= 0) {
        const finalStatus =
          updated.failedCount === updated.recipientCount
            ? CampaignStatus.FAILED
            : CampaignStatus.COMPLETED;

        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: finalStatus },
        });

        sseManager.emit(campaignId, {
          type: 'completed',
          status: finalStatus,
          sentCount: updated.sentCount,
          failedCount: updated.failedCount,
        });
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: 5,
    }
  );

  worker.on('error', (err) => {
    console.error('[Worker Error]', err.message);
  });

  console.log('[Worker] Email worker started');
}

export async function enqueueCampaign(campaignId: string, batchSize: number, batchDelay: number): Promise<void> {
  const recipients = await prisma.recipient.findMany({
    where: { campaignId, status: RecipientStatus.PENDING },
    select: { id: true },
  });

  let delay = 0;
  for (let i = 0; i < recipients.length; i++) {
    if (i > 0 && i % batchSize === 0) delay += batchDelay;
    await emailQueue.add(
      'send-email',
      { recipientId: recipients[i].id, campaignId },
      { delay }
    );
  }
}

export async function drainCampaignJobs(campaignId: string): Promise<void> {
  const jobs = await emailQueue.getJobs(['waiting', 'delayed']);
  for (const job of jobs) {
    if (job.data?.campaignId === campaignId) {
      await job.remove();
    }
  }
}
