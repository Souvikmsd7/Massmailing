import { Response, Router } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { uploadPdf } from '../../middleware/upload';
import {
  uploadResume,
  listResumes,
  getResume,
  deleteResume,
  parseResume,
} from '../../services/career/resumeService';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';

const router = Router();

// POST /api/career/resumes
router.post('/', (req: AuthRequest, res: Response): void => {
  uploadPdf(req as any, res, async (err) => {
    if (err) {
      res.status(400).json({ success: false, error: { code: 'UPLOAD_ERROR', message: err.message } });
      return;
    }
    if (!req.file) {
      res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'No resume file provided' } });
      return;
    }
    try {
      const resume = await uploadResume(req.user!.userId, req.file);
      res.status(201).json({ success: true, data: resume });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
        return;
      }
      logger.error('[Resume Route] Upload error', { userId: req.user?.userId }, err as Error);
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to upload resume' } });
    }
  });
});

// GET /api/career/resumes
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const resumes = await listResumes(req.user!.userId);
    res.json({ success: true, data: resumes });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list resumes' } });
  }
});

// GET /api/career/resumes/:id
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const resume = await getResume(String(req.params.id), req.user!.userId);
    res.json({ success: true, data: resume });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get resume' } });
  }
});

// DELETE /api/career/resumes/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await deleteResume(String(req.params.id), req.user!.userId);
    res.json({ success: true, message: 'Resume deleted' });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete resume' } });
  }
});

// POST /api/career/resumes/:id/parse
router.post('/:id/parse', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await parseResume(String(req.params.id), req.user!.userId);
    res.json({
      success: true,
      data: {
        resume: result.resume,
        parsed: result.parsed,
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
      return;
    }
    logger.error('[Resume Route] Parse error', { userId: req.user?.userId, resumeId: req.params.id }, err as Error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to parse resume' } });
  }
});

export default router;
