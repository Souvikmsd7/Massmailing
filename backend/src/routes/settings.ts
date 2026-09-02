import { Response, Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const settingsSchema = z.object({
  senderName: z.string().max(100).optional(),
  senderEmail: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  linkedin: z.string().url().optional().or(z.literal('')),
  portfolio: z.string().url().optional().or(z.literal('')),
  maxRecipientsPerCampaign: z.number().int().min(1).max(10000).optional(),
  emailBatchSize: z.number().int().min(1).max(100).optional(),
  emailBatchDelay: z.number().int().min(1000).max(300000).optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
});

// GET /api/settings
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    let settings = await prisma.settings.findUnique({ where: { userId } });

    if (!settings) {
      // Create default settings
      settings = await prisma.settings.create({
        data: { userId },
      });
    }

    res.json({ settings });
  } catch (err) {
    console.error('[Settings] Get error:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings
router.put('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const settings = await prisma.settings.upsert({
      where: { userId },
      create: { userId, ...parsed.data },
      update: parsed.data,
    });

    res.json({ settings });
  } catch (err) {
    console.error('[Settings] Update error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
