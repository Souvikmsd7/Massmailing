import { Response, Router } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/auth';
import { getProfile, upsertProfile } from '../../services/career/candidateService';
import { AppError } from '../../utils/errors';

const router = Router();

const candidateProfileSchema = z.object({
  headline: z.string().max(200).optional().nullable(),
  summary: z.string().max(5000).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  preferredLocations: z.array(z.string().max(100)).max(10).optional(),
  remotePreference: z.enum(['remote', 'hybrid', 'onsite']).optional().nullable(),
  preferredRoles: z.array(z.string().max(100)).max(20).optional(),
  salaryMin: z.number().int().min(0).max(10_000_000).optional().nullable(),
  salaryMax: z.number().int().min(0).max(10_000_000).optional().nullable(),
  noticePeriod: z.string().max(100).optional().nullable(),
  workAuthorization: z.string().max(200).optional().nullable(),
  yearsOfExperience: z.number().min(0).max(60).optional().nullable(),
  tools: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().max(100),
        link: z.string().max(1000).optional().nullable(),
        usedFor: z.string().max(1000).optional().nullable(),
        includeInProfile: z.boolean().optional(),
      })
    )
    .max(100)
    .optional()
    .nullable(),
  projects: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().max(100),
        githubUrl: z.string().max(1000).optional().nullable(),
        notes: z.string().max(2000).optional().nullable(),
        includeInProfile: z.boolean().optional(),
      })
    )
    .max(100)
    .optional()
    .nullable(),
});

// GET /api/career/profile
router.get('/profile', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profile = await getProfile(req.user!.userId);
    res.json({ success: true, data: profile ?? null });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch profile' } });
  }
});

// POST /api/career/profile
router.post('/profile', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = candidateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } });
    return;
  }
  try {
    const profile = await upsertProfile(req.user!.userId, parsed.data);
    res.status(201).json({ success: true, data: profile });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create profile' } });
  }
});

// PATCH /api/career/profile
router.patch('/profile', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = candidateProfileSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } });
    return;
  }
  try {
    const profile = await upsertProfile(req.user!.userId, parsed.data);
    res.json({ success: true, data: profile });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update profile' } });
  }
});

export default router;
