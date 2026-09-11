import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient, RecipientStatus, CampaignStatus } from '@prisma/client';
import { sendMail } from '../services/emailService';
import { personalizeEmail } from '../services/personalizationService';
import { sseManager } from '../utils/sse';
import { logger } from '../utils/logger';
import {
  selectHealthySmtpAccount,
  handleSmtpFailure,
  handleSmtpSuccess,
} from '../services/smtpService';

const prisma = new PrismaClient();
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function createRedisConnection() {
  return new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
}

export const emailQueue = new Queue('email-sending', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
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
      const logContext = { jobId: job.id, campaignId, recipientId, isFollowUp };

      // 1. Campaign state check
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
      });

      if (!campaign || campaign.status === CampaignStatus.CANCELLED) {
        if (!isFollowUp) {
          await prisma.recipient.update({
            where: { id: recipientId },
            data: { status: RecipientStatus.CANCELLED },
          }).catch(() => {});
        }
        logger.info('[Worker] Job skipped - Campaign cancelled or missing', logContext);
        return;
      }

      if (campaign.status === CampaignStatus.PAUSED) {
        logger.warn('[Worker] Campaign is paused - throwing job error to delay retry', logContext);
        throw new Error('CAMPAIGN_PAUSED');
      }

      // 2. Recipient state check (Idempotency safeguard)
      const recipient = await prisma.recipient.findUnique({ where: { id: recipientId } });
      if (!recipient) return;

      if (isFollowUp) {
        if (recipient.openCount > 0) {
          logger.info('[Follow-Up Skipped] Recipient already opened original email', logContext);
          return;
        }
      } else {
        if (recipient.status === RecipientStatus.SENT) {
          logger.info('[Worker] Idempotent skip - Recipient already marked SENT', logContext);
          return;
        }
        if (recipient.status === RecipientStatus.PROCESSING) {
          logger.info('[Worker] Idempotent skip - Recipient currently PROCESSING', logContext);
          return;
        }

        // Mark recipient status as PROCESSING immediately
        await prisma.recipient.update({
          where: { id: recipientId },
          data: { status: RecipientStatus.PROCESSING },
        });
      }

      // 3. Emit SSE Event
      sseManager.emit(campaignId, {
        type: isFollowUp ? 'sending_followup' : 'sending',
        recipientId,
        email: recipient.email,
      });

      // 4. Load User Settings
      const settings = await prisma.settings.findUnique({ where: { userId: campaign.userId } });
      const sender = {
        senderName: settings?.senderName || process.env.SMTP_FROM_NAME || '',
        senderEmail: settings?.senderEmail || process.env.SMTP_FROM_EMAIL || '',
        phone: settings?.phone || '',
        linkedin: settings?.linkedin || '',
        portfolio: settings?.portfolio || '',
      };

      const rawSubject = isFollowUp
        ? campaign.followUpSubject || `Re: ${campaign.subject}`
        : campaign.subject;
      const rawBody = isFollowUp
        ? campaign.followUpBody || campaign.body
        : campaign.body;

      // 5. Personalize Content
      const { subject, html: rawHtml } = personalizeEmail(
        rawSubject,
        rawBody,
        {
          name: recipient.name || '',
          email: recipient.email,
          company: recipient.company || '',
          jobTitle: recipient.jobTitle || '',
          phone: recipient.phone || '',
          linkedin: recipient.linkedin || '',
        },
        sender
      );

      // 6. Tracking Pixel Injection
      const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const trackedHtml = rawHtml.replace(/<a\s+(?:[^>]*?\s+)?href=["'](https?:\/\/[^"']+)["']/gi, (match, url) => {
        const trackingUrl = `${apiUrl}/api/track/click/${recipientId}?url=${encodeURIComponent(url)}`;
        return match.replace(url, trackingUrl);
      });
      const trackingPixel = `<img src="${apiUrl}/api/track/open/${recipientId}.png" width="1" height="1" alt="" style="display:none;width:1px;height:1px;" />`;
      const html = trackedHtml.includes('</body>')
        ? trackedHtml.replace('</body>', `${trackingPixel}</body>`)
        : trackedHtml + trackingPixel;

      const attachments: any[] = [];
      if (!isFollowUp && campaign.attachmentPath && campaign.attachmentName) {
        attachments.push({
          filename: campaign.attachmentName,
          path: campaign.attachmentPath,
        });
      }

      // 7. Select Healthy Provider (Provider-Aware Rotation)
      const selectedSmtpAccount = await selectHealthySmtpAccount(campaign.userId);

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
          await handleSmtpSuccess(selectedSmtpAccount.id);
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

          if (campaign.enableFollowUp && campaign.followUpBody) {
            const delayMs = (campaign.followUpDays || 3) * 24 * 60 * 60 * 1000;
            await emailQueue.add(
              'send-followup',
              { recipientId, campaignId, isFollowUp: true },
              { delay: delayMs }
            );
          }
        } else {
          await prisma.emailLog.create({
            data: { recipientId, campaignId, status: 'FOLLOWUP_SENT' },
          });
        }

        sseManager.emit(campaignId, {
          type: isFollowUp ? 'followup_sent' : 'sent',
          recipientId,
          email: recipient.email,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error('[Worker] Email send error', logContext, err);

        if (selectedSmtpAccount) {
          await handleSmtpFailure(selectedSmtpAccount.id, errorMessage);
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

      // 8. Check Campaign Completion Status
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
    logger.error('[Worker] Queue error', {}, err);
  });

  logger.info('[Worker] Email worker started');
}

export async function enqueueCampaign(
  campaignId: string,
  batchSize: number,
  batchDelay: number
): Promise<void> {
  const recipients = await prisma.recipient.findMany({
    where: { campaignId, status: RecipientStatus.PENDING },
    select: { id: true },
  });

  // Mark status as QUEUED
  await prisma.recipient.updateMany({
    where: { id: { in: recipients.map((r) => r.id) } },
    data: { status: RecipientStatus.QUEUED },
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
      await job.remove().catch(() => {});
    }
  }
}
