import { Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const templateSchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
});

async function getUserName(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  return user?.name || 'User';
}

// GET /api/templates
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const search = (req.query.search as string) || '';

    const templates = await prisma.template.findMany({
      where: {
        userId,
        ...(search ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { subject: { contains: search, mode: 'insensitive' as const } },
            { body: { contains: search, mode: 'insensitive' as const } },
          ],
        } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ templates });
  } catch (err) {
    console.error('[Templates] List error:', err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// GET /api/templates/:id
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const template = await prisma.template.findFirst({ where: { id, userId } });
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.json({ template });
  } catch (err) {
    console.error('[Templates] Get error:', err);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// POST /api/templates
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const userName = await getUserName(userId);
    const parsed = templateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const template = await prisma.template.create({
      data: {
        userId,
        ...parsed.data,
        createdBy: userName,
        updatedBy: userName,
      },
    });

    res.status(201).json({ template });
  } catch (err) {
    console.error('[Templates] Create error:', err);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// PUT /api/templates/:id
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const userName = await getUserName(userId);
    const parsed = templateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const existing = await prisma.template.findFirst({ where: { id, userId } });
    if (!existing) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    const template = await prisma.template.update({
      where: { id },
      data: {
        ...parsed.data,
        updatedBy: userName,
      },
    });

    res.json({ template });
  } catch (err) {
    console.error('[Templates] Update error:', err);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// DELETE /api/templates/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const existing = await prisma.template.findFirst({ where: { id, userId } });
    if (!existing) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    await prisma.template.delete({ where: { id } });
    res.json({ message: 'Template deleted' });
  } catch (err) {
    console.error('[Templates] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

export default router;
