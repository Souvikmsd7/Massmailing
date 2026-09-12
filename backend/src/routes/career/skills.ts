import { Response, Router } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/auth';
import {
  listCandidateSkills,
  upsertCandidateSkills,
  removeCandidateSkill,
} from '../../services/career/skillService';
import { ensureProfile } from '../../services/career/candidateService';
import { AppError } from '../../utils/errors';

const router = Router();

const addSkillSchema = z.object({
  name: z.string().min(1).max(100),
});

// GET /api/career/skills
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const candidateId = await ensureProfile(req.user!.userId);
    const skills = await listCandidateSkills(candidateId);
    res.json({ success: true, data: skills });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list skills' } });
  }
});

// POST /api/career/skills
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = addSkillSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() } });
    return;
  }
  try {
    const candidateId = await ensureProfile(req.user!.userId);
    await upsertCandidateSkills(candidateId, [parsed.data.name], 'MANUAL');
    const skills = await listCandidateSkills(candidateId);
    res.status(201).json({ success: true, data: skills });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to add skill' } });
  }
});

// DELETE /api/career/skills/:skillId
router.delete('/:skillId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const candidateId = await ensureProfile(req.user!.userId);
    await removeCandidateSkill(candidateId, String(req.params.skillId));
    res.json({ success: true, message: 'Skill removed' });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to remove skill' } });
  }
});

export default router;
