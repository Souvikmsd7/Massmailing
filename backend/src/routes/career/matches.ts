/**
 * Career Job Matches API Routes.
 *
 * All routes require authentication (applied via server.ts).
 * User authorization strictly enforced: candidates can ONLY compute or view matches for their OWN profile.
 */

import { Response, Router } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/auth';
import { ensureProfile, getProfile } from '../../services/career/candidateService';
import {
  calculateJobMatch,
  listCandidateMatches,
  getMatchById,
} from '../../services/matching/jobMatchService';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';

const router = Router();

const PostMatchSchema = z.object({
  jobId: z.string().trim().min(1, 'jobId is required'),
  forceRecalculate: z.boolean().optional(),
});

const ListMatchesQuerySchema = z.object({
  minScore: z.coerce.number().min(0).max(100).optional(),
  status: z.enum(['CALCULATING', 'READY', 'FAILED', 'STALE']).optional(),
  jobId: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const MatchIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Match ID cannot be empty'),
});

function zodValidationError(issues: z.ZodIssue[]) {
  return {
    code: 'VALIDATION_ERROR',
    message: issues.map((i) => i.message).join('; '),
  };
}

// ─── POST /api/career/matches ───────────────────────────────────────────
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = PostMatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: zodValidationError(parsed.error.issues) });
      return;
    }

    const userId = req.user!.userId;
    const candidateProfileId = await ensureProfile(userId);

    const { jobId, forceRecalculate } = parsed.data;
    const match = await calculateJobMatch(candidateProfileId, jobId, { forceRecalculate });

    res.status(200).json({
      success: true,
      data: match,
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
      return;
    }
    logger.error('[Matches Route] Error calculating job match', {}, err as Error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to calculate job match' },
    });
  }
});

// ─── GET /api/career/matches ────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = ListMatchesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: zodValidationError(parsed.error.issues) });
      return;
    }

    const userId = req.user!.userId;
    const profile = await getProfile(userId);

    if (!profile) {
      res.json({
        success: true,
        data: {
          matches: [],
          pagination: { total: 0, page: 1, limit: parsed.data.limit, pages: 0 },
        },
      });
      return;
    }

    const result = await listCandidateMatches(profile.id, parsed.data);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
      return;
    }
    logger.error('[Matches Route] Error listing matches', {}, err as Error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list job matches' },
    });
  }
});

// ─── GET /api/career/matches/:id ─────────────────────────────────────────
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = MatchIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: zodValidationError(parsed.error.issues) });
      return;
    }

    const userId = req.user!.userId;
    const profile = await getProfile(userId);

    if (!profile) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Match record not found' } });
      return;
    }

    const match = await getMatchById(parsed.data.id, profile.id);
    res.json({ success: true, data: match });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
      return;
    }
    logger.error('[Matches Route] Error getting match details', { matchId: req.params.id }, err as Error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve match details' },
    });
  }
});

export default router;
