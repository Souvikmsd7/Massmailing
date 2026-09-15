import { PrismaClient } from '@prisma/client';
// pdf-parse is a CommonJS module; use require() to avoid TS call-signature issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number }>;
import { NotFoundError, ForbiddenError, BadRequestError } from '../../utils/errors';
import { storeFile, getFilePath, deleteStoredFile } from './storageService';
import { parseResumeText } from '../ai/resumeParser';
import { upsertCandidateSkills } from './skillService';
import { upsertProfile, ensureProfile } from './candidateService';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

const ALLOWED_MIME_TYPES = ['application/pdf'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Validate uploaded resume file (MIME type + size).
 * Throws BadRequestError if invalid.
 */
export function validateResumeFile(file: Express.Multer.File): void {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new BadRequestError(
      `Unsupported file type: ${file.mimetype}. Only PDF is supported.`,
      'UNSUPPORTED_FILE_TYPE'
    );
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new BadRequestError(
      `File too large. Maximum size is 10MB.`,
      'FILE_TOO_LARGE'
    );
  }
}

/**
 * Upload a resume file for a candidate.
 * - Validates file
 * - Stores file using storageService (UUID key, no user filename in path)
 * - Creates Resume record in DB
 * - Creates an initial ResumeVersion("original") record
 */
export async function uploadResume(
  userId: string,
  file: Express.Multer.File
) {
  validateResumeFile(file);

  const candidateId = await ensureProfile(userId);

  // Store file content from disk (multer already wrote it)
  const fs = await import('fs');
  const buffer = fs.readFileSync(file.path);

  // Clean up the temp multer file
  try { fs.unlinkSync(file.path); } catch { /* ignore */ }

  const storageKey = storeFile(buffer, '.pdf');

  const resume = await prisma.resume.create({
    data: {
      candidateId,
      fileName: file.originalname,
      fileType: 'application/pdf',
      storageKey,
      status: 'UPLOADED',
    },
  });

  // Create original version record
  await prisma.resumeVersion.create({
    data: {
      resumeId: resume.id,
      name: 'Original',
      type: 'original',
      content: { storageKey },
    },
  });

  logger.info('[ResumeService] Resume uploaded', { resumeId: resume.id, candidateId });
  const { storageKey: _sk, rawText: _rt, ...publicResume } = resume;
  return publicResume;
}

/**
 * List all resumes for the authenticated user's candidate profile.
 */
export async function listResumes(userId: string) {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) return [];

  return prisma.resume.findMany({
    where: { candidateId: profile.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fileName: true,
      fileType: true,
      status: true,
      isOriginal: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Internal helper to fetch a resume and enforce candidate profile ownership.
 * Throws NotFoundError if resume does not exist, or ForbiddenError if owned by another user.
 */
export async function getResume(resumeId: string, userId: string) {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) {
    throw new NotFoundError('Candidate profile not found', 'PROFILE_NOT_FOUND');
  }

  const resume = await prisma.resume.findUnique({
    where: { id: resumeId },
  });
  if (!resume) {
    throw new NotFoundError('Resume not found', 'RESUME_NOT_FOUND');
  }
  if (resume.candidateId !== profile.id) {
    throw new ForbiddenError('Access denied', 'FORBIDDEN');
  }
  return resume;
}

/**
 * Get a single resume for API response — strips private fields (storageKey, rawText).
 */
export async function getResumePublic(resumeId: string, userId: string) {
  const resume = await getResume(resumeId, userId);
  const { storageKey, rawText, ...publicResume } = resume;
  return publicResume;
}

/**
 * Delete a resume — enforces ownership, removes stored file.
 * Original resume files are tracked but can still be deleted by the owner.
 */
export async function deleteResume(resumeId: string, userId: string) {
  const resume = await getResume(resumeId, userId);

  await prisma.resume.delete({ where: { id: resumeId } });
  deleteStoredFile(resume.storageKey);

  logger.info('[ResumeService] Resume deleted', { resumeId });
}

/**
 * Parse a resume:
 * 1. Extract text from PDF
 * 2. Send to Gemini
 * 3. Validate with Zod
 * 4. Save parsedData + rawText, upsert skills, and update profile inside a Prisma transaction
 */
export async function parseResume(resumeId: string, userId: string) {
  const resume = await getResume(resumeId, userId);

  if (resume.status === 'PROCESSING') {
    throw new BadRequestError('Resume is already being processed', 'ALREADY_PROCESSING');
  }

  // Mark as processing
  await prisma.resume.update({
    where: { id: resumeId },
    data: { status: 'PROCESSING' },
  });

  try {
    // 1. Extract text
    const filePath = getFilePath(resume.storageKey);
    const fs = await import('fs');
    const buffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(buffer);
    const rawText = pdfData.text;

    // 2. Parse with Gemini
    const parsed = await parseResumeText(rawText);

    if (!parsed) {
      await prisma.resume.update({
        where: { id: resumeId },
        data: { status: 'FAILED', rawText },
      });
      logger.warn('[ResumeService] Parsing failed — Gemini returned null', { resumeId });
      const failedResume = await prisma.resume.findUnique({ where: { id: resumeId } });
      const { storageKey, rawText: _rt, ...publicFailed } = failedResume!;
      return { resume: publicFailed, parsed: null };
    }

    // 3. Save resume, skills, and candidate profile in an atomic Prisma transaction.
    // NOTE: Gemini was called BEFORE the transaction — never open a tx while waiting for AI.
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    const updated = await prisma.$transaction(async (tx) => {
      const resRecord = await tx.resume.update({
        where: { id: resumeId },
        data: {
          status: 'PARSED',
          rawText,
          parsedData: parsed as any,
        },
      });

      if (profile && parsed.skills?.length) {
        // Pass tx so skills are persisted atomically — any failure rolls back the entire tx
        await upsertCandidateSkills(profile.id, parsed.skills, 'RESUME', tx as any);
      }

      if (profile) {
        await upsertProfile(userId, {
          headline: parsed.headline ?? undefined,
          summary: parsed.summary ?? undefined,
          location: parsed.location ?? undefined,
          yearsOfExperience: parsed.yearsOfExperience ?? undefined,
        });
      }

      return resRecord;
    });

    logger.info('[ResumeService] Resume parsed successfully', { resumeId, skillCount: parsed.skills?.length ?? 0 });
    const { storageKey, rawText: _rt, ...publicUpdated } = updated;
    return { resume: publicUpdated, parsed };
  } catch (err) {
    await prisma.resume.update({
      where: { id: resumeId },
      data: { status: 'FAILED' },
    });
    logger.error('[ResumeService] Unexpected error during parsing', { resumeId }, err as Error);
    throw err;
  }
}
