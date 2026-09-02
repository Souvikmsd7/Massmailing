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
}

let worker: Worker | null = null;

export function startWorker(): void {
  if (worker) return;

  worker = new Worker<EmailJobData>(
    'email-sending',
    async (job: Job<EmailJobData>) => {
      const { recipientId, campaignId } = job.data;

      // Check if campaign is still active
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
      });

      if (!campaign || campaign.status === CampaignStatus.STOPPED) {
        // Mark as cancelled
        await prisma.recipient.update({
          where: { id: recipientId },
          data: { status: RecipientStatus.CANCELLED },
        });
        return;
      }

      if (campaign.status === CampaignStatus.PAUSED) {
        throw new Error('PAUSED');
      }

      // Load recipient
      const recipient = await prisma.recipient.findUnique({ where: { id: recipientId } });
      if (!recipient || recipient.status === RecipientStatus.SENT) return;

      // Mark as SENDING
      await prisma.recipient.update({
        where: { id: recipientId },
        data: { status: RecipientStatus.SENDING },
      });

      // Emit SSE event
      sseManager.emit(campaignId, {
        type: 'sending',
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

      // Personalize email
      const { subject, html } = personalizeEmail(campaign.subject, campaign.body, {
        name: recipient.name || '',
        email: recipient.email,
        company: recipient.company || '',
        jobTitle: recipient.jobTitle || '',
        phone: recipient.phone || '',
        linkedin: recipient.linkedin || '',
      }, sender);

      // Build attachments
      const attachments = [];
      if (campaign.attachmentPath && campaign.attachmentName) {
        attachments.push({
          filename: campaign.attachmentName,
          path: campaign.attachmentPath,
        });
      }

      try {
        await sendMail({ to: recipient.email, subject, html, attachments });

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

        sseManager.emit(campaignId, { type: 'sent', recipientId, email: recipient.email });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';

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
