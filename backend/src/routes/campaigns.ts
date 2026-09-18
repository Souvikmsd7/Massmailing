import { Response, Router } from 'express';
import { PrismaClient, CampaignStatus, RecipientStatus } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { uploadResume } from '../middleware/upload';
import { z } from 'zod';
import { enqueueCampaign, drainCampaignJobs } from '../workers/emailWorker';
import { sseManager } from '../utils/sse';
import { CampaignStateMachine } from '../services/campaignState';
import { logger } from '../utils/logger';
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
  enableFollowUp: z.boolean().optional().default(false),
  followUpDays: z.number().int().min(1).max(30).optional().default(3),
  followUpSubject: z.string().optional(),
  followUpBody: z.string().optional(),
  scheduledAt: z.string().optional(),
  recipients: z
    .array(
      z.object({
        email: z.string().email(),
        name: z.string().optional(),
        company: z.string().optional(),
        jobTitle: z.string().optional(),
        phone: z.string().optional(),
        linkedin: z.string().optional(),
      })
    )
    .min(1),
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

    const {
      name,
      subject,
      body: emailBody,
      batchSize,
      batchDelay,
      maxRetries,
      enableFollowUp,
      followUpDays,
      followUpSubject,
      followUpBody,
      scheduledAt,
      recipients,
    } = parsed.data;

    let targetScheduledAt: Date | undefined;
    let initialStatus: CampaignStatus = CampaignStatus.DRAFT;

    if (scheduledAt) {
      const parsedDate = new Date(scheduledAt);
      if (isNaN(parsedDate.getTime())) {
        res.status(400).json({ error: 'Invalid scheduledAt date format' });
        return;
      }
      if (parsedDate <= new Date()) {
        res.status(400).json({ error: 'Scheduled time must be in the future' });
        return;
      }
      targetScheduledAt = parsedDate;
      initialStatus = CampaignStatus.SCHEDULED;
    }

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
        status: initialStatus,
        scheduledAt: targetScheduledAt,
        recipientCount: recipients.length,
        pendingCount: recipients.length,
        batchSize: batchSize || settings?.emailBatchSize || 5,
        batchDelay: batchDelay || settings?.emailBatchDelay || 10000,
        maxRetries: maxRetries || settings?.maxRetries || 3,
        enableFollowUp,
        followUpDays,
        followUpSubject,
        followUpBody,
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

    logger.info('Created new campaign', { campaignId: campaign.id, userId });
    res.status(201).json({ campaign });
  } catch (err) {
    logger.error('[Campaigns] Create error', { userId: req.user?.userId }, err);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// GET /api/campaigns
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '20', 10);
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
          openedCount: true,
          clickedCount: true,
          scheduledAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.campaign.count({ where: { userId } }),
    ]);

    res.json({ campaigns, total, page, limit });
  } catch (err) {
    logger.error('[Campaigns] List error', { userId: req.user?.userId }, err);
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
    logger.error('[Campaigns] Get error', { userId: req.user?.userId, campaignId: String(req.params.id) }, err);
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

    CampaignStateMachine.validateTransition(campaign.status, CampaignStatus.PROCESSING, id);

    const userName = user?.name || '';
    await prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.PROCESSING, updatedBy: userName },
    });

    await enqueueCampaign(id, campaign.batchSize, campaign.batchDelay);
    logger.info('Started campaign processing', { campaignId: id, userId });

    res.json({ message: 'Campaign started', campaignId: id });
  } catch (err: any) {
    logger.error('[Campaigns] Start error', { userId: req.user?.userId, campaignId: String(req.params.id) }, err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to start campaign' });
  }
});

// POST /api/campaigns/:id/schedule
router.post('/:id/schedule', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const { scheduledAt } = req.body;

    if (!scheduledAt) {
      res.status(400).json({ error: 'scheduledAt is required' });
      return;
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      res.status(400).json({ error: 'Invalid scheduledAt date format' });
      return;
    }

    if (scheduledDate <= new Date()) {
      res.status(400).json({ error: 'Scheduled date must be in the future' });
      return;
    }

    const [campaign, user] = await Promise.all([
      prisma.campaign.findFirst({ where: { id, userId } }),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ]);

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    CampaignStateMachine.validateTransition(campaign.status, CampaignStatus.SCHEDULED, id);

    const userName = user?.name || '';
    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        status: CampaignStatus.SCHEDULED,
        scheduledAt: scheduledDate,
        updatedBy: userName,
      },
    });

    sseManager.emit(id, { type: 'scheduled', scheduledAt: scheduledDate.toISOString() });
    logger.info('Scheduled campaign', { campaignId: id, userId, scheduledAt: scheduledDate });

    res.json({ message: 'Campaign scheduled successfully', campaign: updated });
  } catch (err: any) {
    logger.error('[Campaigns] Schedule error', { userId: req.user?.userId, campaignId: String(req.params.id) }, err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to schedule campaign' });
  }
});

// POST /api/campaigns/:id/unschedule
router.post('/:id/unschedule', async (req: AuthRequest, res: Response): Promise<void> => {
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

    CampaignStateMachine.validateTransition(campaign.status, CampaignStatus.DRAFT, id);

    const userName = user?.name || '';
    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        status: CampaignStatus.DRAFT,
        scheduledAt: null,
        updatedBy: userName,
      },
    });

    sseManager.emit(id, { type: 'unscheduled' });
    logger.info('Unscheduled campaign (reverted to draft)', { campaignId: id, userId });

    res.json({ message: 'Campaign reverted to draft', campaign: updated });
  } catch (err: any) {
    logger.error('[Campaigns] Unschedule error', { userId: req.user?.userId, campaignId: String(req.params.id) }, err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to unschedule campaign' });
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
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    CampaignStateMachine.validateTransition(campaign.status, CampaignStatus.PAUSED, id);

    const userName = user?.name || '';
    await prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.PAUSED, updatedBy: userName },
    });

    sseManager.emit(id, { type: 'paused' });
    logger.info('Paused campaign', { campaignId: id, userId });
    res.json({ message: 'Campaign paused' });
  } catch (err: any) {
    logger.error('[Campaigns] Pause error', { userId: req.user?.userId, campaignId: String(req.params.id) }, err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to pause campaign' });
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
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    CampaignStateMachine.validateTransition(campaign.status, CampaignStatus.PROCESSING, id);

    const userName = user?.name || '';
    await prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.PROCESSING, updatedBy: userName },
    });

    await enqueueCampaign(id, campaign.batchSize, campaign.batchDelay);
    sseManager.emit(id, { type: 'resumed' });
    logger.info('Resumed campaign', { campaignId: id, userId });
    res.json({ message: 'Campaign resumed' });
  } catch (err: any) {
    logger.error('[Campaigns] Resume error', { userId: req.user?.userId, campaignId: String(req.params.id) }, err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to resume campaign' });
  }
});

// POST /api/campaigns/:id/stop (Cancel)
router.post('/:id/stop', async (req: AuthRequest, res: Response): Promise<void> => {
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

    CampaignStateMachine.validateTransition(campaign.status, CampaignStatus.CANCELLED, id);

    const userName = user?.name || '';
    await prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.CANCELLED, updatedBy: userName },
    });

    await drainCampaignJobs(id);

    await prisma.recipient.updateMany({
      where: { campaignId: id, status: { in: [RecipientStatus.PENDING, RecipientStatus.QUEUED] } },
      data: { status: RecipientStatus.CANCELLED },
    });

    const updated = await prisma.campaign.update({ where: { id }, data: { pendingCount: 0 } });
    sseManager.emit(id, { type: 'stopped', sentCount: updated.sentCount, failedCount: updated.failedCount });
    logger.info('Cancelled campaign', { campaignId: id, userId });
    res.json({ message: 'Campaign cancelled' });
  } catch (err: any) {
    logger.error('[Campaigns] Stop error', { userId: req.user?.userId, campaignId: String(req.params.id) }, err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to stop campaign' });
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
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const userName = user?.name || '';

    const failedRecipients = await prisma.recipient.findMany({
      where: { campaignId: id, status: RecipientStatus.FAILED, retryCount: { lt: campaign.maxRetries } },
      select: { id: true },
    });

    if (failedRecipients.length === 0) {
      res.status(400).json({ error: 'No eligible failed recipients to retry' });
      return;
    }

    await prisma.recipient.updateMany({
      where: { id: { in: failedRecipients.map((r) => r.id) } },
      data: { status: RecipientStatus.PENDING, errorMessage: null },
    });

    const retryCount = failedRecipients.length;
    await prisma.campaign.update({
      where: { id },
      data: {
        status: CampaignStatus.PROCESSING,
        failedCount: { decrement: retryCount },
        pendingCount: { increment: retryCount },
        updatedBy: userName,
      },
    });

    await enqueueCampaign(id, campaign.batchSize, campaign.batchDelay);
    logger.info('Retrying failed campaign recipients', { campaignId: id, count: retryCount });
    res.json({ message: `Retrying ${retryCount} failed emails`, count: retryCount });
  } catch (err: any) {
    logger.error('[Campaigns] Retry error', { userId: req.user?.userId, campaignId: String(req.params.id) }, err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to retry campaign' });
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

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    // CSV Formula Injection Safeguard: prepend single quote to fields starting with =, +, -, @
    const sanitizeCsvField = (val: string | null | undefined): string => {
      if (!val) return '""';
      let clean = val.replace(/"/g, '""');
      if (/^[=+\-@]/.test(clean)) {
        clean = `'${clean}`;
      }
      return `"${clean}"`;
    };

    const headers = 'name,email,company,job_title,status,sent_at,error\n';
    const rows = campaign.recipients
      .map((r) => {
        const sentAt = r.sentAt ? r.sentAt.toISOString() : '';
        return `${sanitizeCsvField(r.name)},"${r.email}",${sanitizeCsvField(r.company)},${sanitizeCsvField(
          r.jobTitle
        )},"${r.status}","${sentAt}",${sanitizeCsvField(r.errorMessage)}`;
      })
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${campaign.name}-results.csv"`);
    res.send(headers + rows);
  } catch (err) {
    logger.error('[Campaigns] Export error', { userId: req.user?.userId, campaignId: String(req.params.id) }, err);
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
      select: {
        status: true,
        sentCount: true,
        failedCount: true,
        pendingCount: true,
        recipientCount: true,
        openedCount: true,
        clickedCount: true,
      },
    });
    if (campaign) {
      res.write(`data: ${JSON.stringify({ type: 'state', ...campaign })}\n\n`);
    }
  } catch {
    /* ignore */
  }

  sseManager.addClient(id, clientId, res);
  req.on('close', () => sseManager.removeClient(id, clientId));
});

export default router;
