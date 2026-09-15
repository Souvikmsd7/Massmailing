import { Response, Router } from 'express';
import { AuthRequest } from '../../middleware/auth';
import {
  enqueueDiscovery,
  listJobs,
  getJobById,
} from '../../services/jobs/jobDiscoveryService';
import { AppError, NotFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';

const router = Router();

// POST /api/career/jobs/discover
router.post('/discover', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { query, keywords, location, limit, sources } = req.body || {};
    const searchKeywords = query || keywords;

    if (!searchKeywords || typeof searchKeywords !== 'string' || !searchKeywords.trim()) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Query/keywords parameter is required' },
      });
      return;
    }

    const jobId = await enqueueDiscovery({
      input: {
        keywords: searchKeywords.trim(),
        location: typeof location === 'string' ? location.trim() : undefined,
        maxResults: typeof limit === 'number' ? limit : undefined,
      },
      sources: Array.isArray(sources) ? sources : undefined,
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

// GET /api/career/jobs
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      search,
      keyword,
      location,
      remoteType,
      employmentType,
      source,
      postedWithin,
      company,
      page,
      limit,
    } = req.query;

    const result = await listJobs({
      keyword: typeof search === 'string' ? search : typeof keyword === 'string' ? keyword : undefined,
      location: typeof location === 'string' ? location : undefined,
      remoteType: typeof remoteType === 'string' ? remoteType : undefined,
      employmentType: typeof employmentType === 'string' ? employmentType : undefined,
      source: typeof source === 'string' ? source : undefined,
      postedWithin: typeof postedWithin === 'string' ? postedWithin : undefined,
      company: typeof company === 'string' ? company : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });

    res.json({
      success: true,
      data: result,
    });
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

// GET /api/career/jobs/:id
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const jobId = String(req.params.id);
    const job = await getJobById(jobId);

    if (!job) {
      throw new NotFoundError('Job not found', 'JOB_NOT_FOUND');
    }

    res.json({
      success: true,
      data: job,
    });
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
