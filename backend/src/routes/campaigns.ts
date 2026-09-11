import { Response, Router } from 'express';
import { PrismaClient, CampaignStatus, RecipientStatus } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { uploadResume } from '../middleware/upload';
import { z } from 'zod';
import { enqueueCampaign, drainCampaignJobs } from '../workers/emailWorker';
import { sseManager } from '../utils/sse';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const prisma = new PrismaClient();

const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  batchSize: z.number().int().min(1).max(50).optional(),
  batchDelay: z.number().int().min(1000).max(60000).optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
  recipients: z.array(z.object({
    email: z.string().email(),
    name: z.string().optional(),
    company: z.string().optional(),
    jobTitle: z.string().optional(),
    phone: z.string().optional(),
    linkedin: z.string().optional(),
  })).min(1),
});

// POST /api/campaigns
router.post('/', uploadResume, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const bodyData = JSON.parse(req.body.data || '{}');
    const parsed = createCampaignSchema.safeParse(bodyData);

    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { name, subject, body: emailBody, batchSize, batchDelay, maxRetries, recipients } = parsed.data;

    const [settings, user] = await Promise.all([
      prisma.settings.findUnique({ where: { userId } }),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ]);
    const maxRecipients = settings?.maxRecipientsPerCampaign || 500;
    const userName = user?.name || '';

    if (recipients.length > maxRecipients) {
      res.status(400).json({ error: `Maximum ${maxRecipients} recipients per campaign` });
      return;
    }

    let attachmentPath: string | undefined;
    let attachmentName: string | undefined;
    if (req.file) {
      attachmentPath = req.file.path;
      attachmentName = req.file.originalname;
    }

    const campaign = await prisma.campaign.create({
      data: {
        userId,
        name,
        subject,
        body: emailBody,
        recipientCount: recipients.length,
        pendingCount: recipients.length,
        batchSize: batchSize || settings?.emailBatchSize || 5,
        batchDelay: batchDelay || settings?.emailBatchDelay || 10000,
        maxRetries: maxRetries || settings?.maxRetries || 3,
        attachmentPath,
        attachmentName,
        createdBy: userName,
        updatedBy: userName,
        recipients: {
          create: recipients.map((r) => ({
            email: r.email,
            name: r.name,
            company: r.company,
            jobTitle: r.jobTitle,
            phone: r.phone,
            linkedin: r.linkedin,
          })),
        },
      },
    });

    res.status(201).json({ campaign });
  } catch (err) {
    console.error('[Campaigns] Create error:', err);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// GET /api/campaigns
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const skip = (page - 1) * limit;

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          status: true,
          subject: true,
          recipientCount: true,
          sentCount: true,
          failedCount: true,
          pendingCount: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.campaign.count({ where: { userId } }),
    ]);

    res.json({ campaigns, total, page, limit });
  } catch (err) {
    console.error('[Campaigns] List error:', err);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// GET /api/campaigns/:id
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const campaign = await prisma.campaign.findFirst({
      where: { id, userId },
      include: {
        recipients: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    res.json({ campaign });
  } catch (err) {
    console.error('[Campaigns] Get error:', err);
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

// POST /api/campaigns/:id/start
router.post('/:id/start', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const [campaign, user] = await Promise.all([
      prisma.campaign.findFirst({ where: { id, userId } }),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ]);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }
    const userName = user?.name || '';

    if (campaign.status === CampaignStatus.SENDING) {
      res.status(400).json({ error: 'Campaign is already sending' });
      return;
    }

    if (campaign.status === CampaignStatus.COMPLETED || campaign.status === CampaignStatus.STOPPED) {
      res.status(400).json({ error: 'Campaign has already completed or been stopped' });
      return;
    }

    await prisma.campaign.update({ where: { id }, data: { status: CampaignStatus.SENDING, updatedBy: userName } });
    await enqueueCampaign(id, campaign.batchSize, campaign.batchDelay);

    res.json({ message: 'Campaign started', campaignId: id });
  } catch (err) {
    console.error('[Campaigns] Start error:', err);
    res.status(500).json({ error: 'Failed to start campaign' });
  }
});

// POST /api/campaigns/:id/pause
router.post('/:id/pause', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const [campaign, user] = await Promise.all([
      prisma.campaign.findFirst({ where: { id, userId } }),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ]);
    if (!campaign) { res.status(404).json({ error: 'Campaign not found' }); return; }
    if (campaign.status !== CampaignStatus.SENDING) {
      res.status(400).json({ error: 'Campaign is not currently sending' }); return;
    }
    const userName = user?.name || '';
    await prisma.campaign.update({ where: { id }, data: { status: CampaignStatus.PAUSED, updatedBy: userName } });
    sseManager.emit(id, { type: 'paused' });
    res.json({ message: 'Campaign paused' });
  } catch (err) {
    console.error('[Campaigns] Pause error:', err);
    res.status(500).json({ error: 'Failed to pause campaign' });
  }
});

// POST /api/campaigns/:id/resume
router.post('/:id/resume', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const [campaign, user] = await Promise.all([
      prisma.campaign.findFirst({ where: { id, userId } }),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ]);
    if (!campaign) { res.status(404).json({ error: 'Campaign not found' }); return; }
    if (campaign.status !== CampaignStatus.PAUSED) {
      res.status(400).json({ error: 'Campaign is not paused' }); return;
    }
    const userName = user?.name || '';
    await prisma.campaign.update({ where: { id }, data: { status: CampaignStatus.SENDING, updatedBy: userName } });
    await enqueueCampaign(id, campaign.batchSize, campaign.batchDelay);
    sseManager.emit(id, { type: 'resumed' });
    res.json({ message: 'Campaign resumed' });
  } catch (err) {
    console.error('[Campaigns] Resume error:', err);
    res.status(500).json({ error: 'Failed to resume campaign' });
  }
});

// POST /api/campaigns/:id/stop
router.post('/:id/stop', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const [campaign, user] = await Promise.all([
      prisma.campaign.findFirst({ where: { id, userId } }),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ]);
    if (!campaign) { res.status(404).json({ error: 'Campaign not found' }); return; }
    const userName = user?.name || '';

    await prisma.campaign.update({ where: { id }, data: { status: CampaignStatus.STOPPED, updatedBy: userName } });
    await drainCampaignJobs(id);

    await prisma.recipient.updateMany({
      where: { campaignId: id, status: RecipientStatus.PENDING },
      data: { status: RecipientStatus.CANCELLED },
    });

    const updated = await prisma.campaign.update({ where: { id }, data: { pendingCount: 0 } });
    sseManager.emit(id, { type: 'stopped', sentCount: updated.sentCount, failedCount: updated.failedCount });
    res.json({ message: 'Campaign stopped' });
  } catch (err) {
    console.error('[Campaigns] Stop error:', err);
    res.status(500).json({ error: 'Failed to stop campaign' });
  }
});

// POST /api/campaigns/:id/retry
router.post('/:id/retry', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const [campaign, user] = await Promise.all([
      prisma.campaign.findFirst({ where: { id, userId } }),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ]);
    if (!campaign) { res.status(404).json({ error: 'Campaign not found' }); return; }
    const userName = user?.name || '';

    const failedRecipients = await prisma.recipient.findMany({
      where: { campaignId: id, status: RecipientStatus.FAILED, retryCount: { lt: campaign.maxRetries } },
      select: { id: true },
    });

    if (failedRecipients.length === 0) {
      res.status(400).json({ error: 'No eligible failed recipients to retry' }); return;
    }

    await prisma.recipient.updateMany({
      where: { id: { in: failedRecipients.map((r) => r.id) } },
      data: { status: RecipientStatus.PENDING, errorMessage: null },
    });

    const retryCount = failedRecipients.length;
    await prisma.campaign.update({
      where: { id },
      data: {
        status: CampaignStatus.SENDING,
        failedCount: { decrement: retryCount },
        pendingCount: { increment: retryCount },
        updatedBy: userName,
      },
    });

    await enqueueCampaign(id, campaign.batchSize, campaign.batchDelay);
    res.json({ message: `Retrying ${retryCount} failed emails`, count: retryCount });
  } catch (err) {
    console.error('[Campaigns] Retry error:', err);
    res.status(500).json({ error: 'Failed to retry campaign' });
  }
});

// GET /api/campaigns/:id/export
router.get('/:id/export', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const campaign = await prisma.campaign.findFirst({
      where: { id, userId },
      include: { recipients: { orderBy: { createdAt: 'asc' } } },
    });

    if (!campaign) { res.status(404).json({ error: 'Campaign not found' }); return; }

    const headers = 'name,email,company,job_title,status,sent_at,error\n';
    const rows = campaign.recipients
      .map((r) => {
        const sentAt = r.sentAt ? r.sentAt.toISOString() : '';
        const error = r.errorMessage ? `"${r.errorMessage.replace(/"/g, '""')}"` : '';
        return `"${r.name || ''}","${r.email}","${r.company || ''}","${r.jobTitle || ''}","${r.status}","${sentAt}",${error}`;
      })
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${campaign.name}-results.csv"`);
    res.send(headers + rows);
  } catch (err) {
    console.error('[Campaigns] Export error:', err);
    res.status(500).json({ error: 'Failed to export campaign' });
  }
});

// GET /api/campaigns/:id/progress (SSE)
router.get('/:id/progress', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const clientId = uuidv4();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: { status: true, sentCount: true, failedCount: true, pendingCount: true, recipientCount: true },
    });
    if (campaign) {
      res.write(`data: ${JSON.stringify({ type: 'state', ...campaign })}\n\n`);
    }
  } catch { /* ignore */ }

  sseManager.addClient(id, clientId, res);
  req.on('close', () => sseManager.removeClient(id, clientId));
});

export default router;
