import { PrismaClient } from '@prisma/client';
import { NotFoundError, ForbiddenError } from '../../utils/errors';

const prisma = new PrismaClient();

export interface UpsertCandidateData {
  headline?: string | null;
  summary?: string | null;
  location?: string | null;
  preferredLocations?: string[];
  remotePreference?: string | null;
  preferredRoles?: string[];
  salaryMin?: number | null;
  salaryMax?: number | null;
  noticePeriod?: string | null;
  workAuthorization?: string | null;
  yearsOfExperience?: number | null;
}

/**
 * Get the candidate profile for a user, or null if not created yet.
 */
export async function getProfile(userId: string) {
  return prisma.candidateProfile.findUnique({
    where: { userId },
    include: {
      skills: {
        include: { skill: true },
        orderBy: { createdAt: 'asc' },
      },
      resumes: {
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
      },
    },
  });
}

/**
 * Create or update the candidate profile. Scoped to userId.
 */
export async function upsertProfile(userId: string, data: UpsertCandidateData) {
  return prisma.candidateProfile.upsert({
    where: { userId },
    create: {
      userId,
      ...data,
    },
    update: data,
    include: {
      skills: { include: { skill: true } },
    },
  });
}

/**
 * Ensure a candidate profile exists, creating a blank one if not.
 * Returns the profile id.
 */
export async function ensureProfile(userId: string): Promise<string> {
  const existing = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.candidateProfile.create({
    data: { userId },
    select: { id: true },
  });
  return created.id;
}

/**
 * Verify a candidateProfile belongs to the given userId.
 * Throws ForbiddenError if not.
 */
export async function assertOwnership(candidateId: string, userId: string): Promise<void> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { userId: true },
  });
  if (!profile) throw new NotFoundError('Candidate profile not found');
  if (profile.userId !== userId) throw new ForbiddenError('Access denied');
}
