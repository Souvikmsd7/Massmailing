/**
 * Career Jobs Routes.
 *
 * All routes require authentication (applied at server.ts level).
 *
 * Input validation is authoritative here — do not rely on frontend validation.
 */

import { Response, Router } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/auth';
import {
  enqueueDiscovery,
  listJobs,
  getJobById,
} from '../../services/jobs/jobDiscoveryService';
import { AppError, NotFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';

const router = Router();

// ─── Validation Schemas ────────────────────────────────────────────────────────

const DiscoverBodySchema = z.object({
  /** Accept both 'keywords' and 'query' for backward compatibility */
  keywords: z.string().trim().min(1, 'keywords is required').max(500).optional(),
  query: z.string().trim().min(1, 'query is required').max(500).optional(),
  location: z.string().trim().max(500).optional(),
  /** maxResults / limit — number of jobs to request from source adapters */
  maxResults: z.number().int('maxResults must be an integer').min(1).max(100).optional(),
  limit: z.number().int('limit must be an integer').min(1).max(100).optional(),
  /** Which source adapters to use */
  sources: z.array(z.string().min(1).max(100)).max(10).optional(),
}).refine(
  (data) => data.keywords || data.query,
  { message: 'keywords or query is required' }
);

const ListJobsQuerySchema = z.object({
  search: z.string().trim().max(500).optional(),
  keyword: z.string().trim().max(500).optional(),
  location: z.string().trim().max(500).optional(),
  remoteType: z.enum(['REMOTE', 'HYBRID', 'ONSITE', 'UNKNOWN'], {
    errorMap: () => ({ message: 'remoteType must be one of: REMOTE, HYBRID, ONSITE, UNKNOWN' }),
  }).optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY', 'UNKNOWN'], {
    errorMap: () => ({ message: 'employmentType must be one of: FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP, TEMPORARY, UNKNOWN' }),
  }).optional(),
  source: z.string().trim().max(100).optional(),
  postedWithin: z.enum(['24h', '7d', '30d'], {
    errorMap: () => ({ message: 'postedWithin must be one of: 24h, 7d, 30d' }),
  }).optional(),
  company: z.string().trim().max(500).optional(),
  page: z.coerce
    .number({ invalid_type_error: 'page must be a number' })
    .int('page must be an integer')
    .min(1, 'page must be >= 1')
    .default(1),
  limit: z.coerce
    .number({ invalid_type_error: 'limit must be a number' })
    .int('limit must be an integer')
    .min(1, 'limit must be >= 1')
    .max(100, 'limit must be <= 100')
    .default(20),
});

const JobIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Job ID cannot be empty').max(200),
});

// ─── Helper ────────────────────────────────────────────────────────────────────

function zodValidationError(issues: z.ZodIssue[]): { code: string; message: string; details: string } {
  return {
    code: 'VALIDATION_ERROR',
    message: issues.map((i) => i.message).join('; '),
    details: JSON.stringify(issues),
  };
}

// ─── POST /api/career/jobs/discover ───────────────────────────────────────────

router.post('/discover', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = DiscoverBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: zodValidationError(parsed.error.issues) });
      return;
    }

    const { keywords, query, location, maxResults, limit, sources } = parsed.data;
    const searchKeywords = (keywords || query)!;
    const effectiveMaxResults = maxResults ?? limit;

    const jobId = await enqueueDiscovery({
      input: {
        keywords: searchKeywords,
        location: location || undefined,
        maxResults: effectiveMaxResults,
      },
      sources,
    });

    res.status(202).json({
      success: true,
      data: {
        jobId,
        status: 'queued',
        message: 'Job discovery queued successfully',
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
      return;
    }
    logger.error('[Jobs Route] Discover error', {}, err as Error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to enqueue job discovery' },
    });
  }
});

// ─── GET /api/career/jobs ─────────────────────────────────────────────────────

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = ListJobsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: zodValidationError(parsed.error.issues) });
      return;
    }

    const { search, keyword, location, remoteType, employmentType, source, postedWithin, company, page, limit } = parsed.data;

    const result = await listJobs({
      keyword: search || keyword,
      location,
      remoteType,
      employmentType,
      source,
      postedWithin,
      company,
      page,
      limit,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
      return;
    }
    logger.error('[Jobs Route] List jobs error', {}, err as Error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list jobs' },
    });
  }
});

// ─── GET /api/career/jobs/:id ─────────────────────────────────────────────────

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = JobIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: zodValidationError(parsed.error.issues) });
      return;
    }

    const { id: jobId } = parsed.data;
    const job = await getJobById(jobId);

    if (!job) {
      throw new NotFoundError('Job not found', 'JOB_NOT_FOUND');
    }

    res.json({ success: true, data: job });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
      return;
    }
    logger.error('[Jobs Route] Get job error', { jobId: String(req.params.id) }, err as Error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve job' },
    });
  }
});

export default router;
