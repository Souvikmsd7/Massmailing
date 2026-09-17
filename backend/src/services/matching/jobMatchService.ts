/**
 * Job Match Service.
 *
 * Primary Orchestrator for Phase 3 Job Matching Engine.
 *
 * Pipeline:
 * Candidate Profile + Job
 *   ↓
 * Hard Filters (Location, Remote, Salary, Experience)
 *   ↓
 * Deterministic Skill Match (EXACT, ALIAS)
 *   ↓
 * Embedding Retrieval / Generation & Vector Similarity
 *   ↓
 * Score Synthesis: 0.30 * HardFilter + 0.45 * Skill + 0.25 * Semantic
 *   ↓
 * Gemini AI Explanation (Validated via Zod)
 *   ↓
 * Atomic JobMatch Database Upsert
 */

import { PrismaClient, MatchStatus } from '@prisma/client';
import { evaluateHardFilters } from './hardFilterService';
import { evaluateSkillMatch } from './skillMatchService';
import { evaluateSemanticMatch } from './semanticMatchService';
import { getOrGenerateEmbedding } from '../ai/embeddingService';
import { generateMatchExplanation } from '../ai/matchExplanationService';
import { NotFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

export interface CalculateMatchOptions {
  forceRecalculate?: boolean;
}

export async function calculateJobMatch(
  candidateProfileId: string,
  jobId: string,
  options: CalculateMatchOptions = {}
) {
  // 1. Fetch Candidate Profile
  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateProfileId },
    include: {
      skills: {
        include: { skill: true },
      },
      resumes: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!candidate) {
    throw new NotFoundError('Candidate profile not found');
  }

  // 2. Fetch Job
  const job = await prisma.job.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new NotFoundError('Job not found');
  }

  // 3. Check for existingREADY match if forceRecalculate is false
  if (!options.forceRecalculate) {
    const existing = await prisma.jobMatch.findUnique({
      where: {
        candidateProfileId_jobId: { candidateProfileId, jobId },
      },
    });

    if (existing && existing.status === 'READY') {
      return existing;
    }
  }

  // 4. Hard Filter Engine
  const hardFilterResult = evaluateHardFilters(candidate, job);

  // 5. Skill Match Engine
  const skillResult = evaluateSkillMatch(candidate.skills, job.skills);

  // 6. Embedding & Semantic Similarity
  const candidateSkillNames = candidate.skills.map((s) => s.skill.name).join(', ');
  const latestResumeText = candidate.resumes[0]?.rawText?.slice(0, 1000) || '';
  const candidateText = `
Role: ${candidate.headline || ''}
Summary: ${candidate.summary || ''}
Skills: ${candidateSkillNames}
Experience: ${latestResumeText}
`.trim();

  const jobText = `
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || ''}
Skills: ${job.skills.join(', ')}
Description: ${job.description?.slice(0, 1000) || ''}
`.trim();

  const [candidateVector, jobVector] = await Promise.all([
    getOrGenerateEmbedding('CANDIDATE', candidateProfileId, candidateText),
    getOrGenerateEmbedding('JOB', jobId, jobText),
  ]);

  const semanticResult = evaluateSemanticMatch(candidateVector, jobVector);

  // 7. Overall Score Calculation
  // Formula: hardFilterScore * 0.30 + skillScore * 0.45 + semanticScore * 0.25
  const rawOverallScore =
    hardFilterResult.hardFilterScore * 0.30 +
    skillResult.skillScore * 0.45 +
    semanticResult.semanticScore * 0.25;

  const overallScore = Math.round(rawOverallScore);

  // 8. Gemini Explanation Synthesis
  const explanation = await generateMatchExplanation({
    jobTitle: job.title,
    company: job.company,
    matchedSkills: skillResult.matchedSkills.map((m) => m.candidateSkill),
    missingSkills: skillResult.missingSkills,
    hardFilterEligible: hardFilterResult.eligible,
    failedFilters: hardFilterResult.failedFilters,
    skillScore: skillResult.skillScore,
    semanticScore: semanticResult.semanticScore,
    overallScore,
  });

  // 9. Persist JobMatch Record
  const jobMatch = await prisma.jobMatch.upsert({
    where: {
      candidateProfileId_jobId: { candidateProfileId, jobId },
    },
    update: {
      overallScore,
      hardFilterScore: hardFilterResult.hardFilterScore,
      skillScore: skillResult.skillScore,
      semanticScore: semanticResult.semanticScore,
      status: MatchStatus.READY,
      hardFilterResults: hardFilterResult as any,
      skillMatchResults: skillResult as any,
      explanation: explanation as any,
      updatedAt: new Date(),
    },
    create: {
      candidateProfileId,
      jobId,
      overallScore,
      hardFilterScore: hardFilterResult.hardFilterScore,
      skillScore: skillResult.skillScore,
      semanticScore: semanticResult.semanticScore,
      status: MatchStatus.READY,
      hardFilterResults: hardFilterResult as any,
      skillMatchResults: skillResult as any,
      explanation: explanation as any,
    },
    include: {
      job: {
        select: {
          id: true,
          title: true,
          company: true,
          location: true,
          remoteType: true,
          employmentType: true,
          salaryMin: true,
          salaryMax: true,
          salaryCurrency: true,
          postedAt: true,
          status: true,
          skills: true,
        },
      },
    },
  });

  logger.info(`[JobMatchService] Calculated match for candidate ${candidateProfileId} and job ${jobId}`, {
    overallScore,
    eligible: hardFilterResult.eligible,
  });

  return jobMatch;
}

export interface ListCandidateMatchesOptions {
  minScore?: number;
  status?: MatchStatus;
  jobId?: string;
  page?: number;
  limit?: number;
}

export async function listCandidateMatches(
  candidateProfileId: string,
  options: ListCandidateMatchesOptions = {}
) {
  const { minScore, status, jobId, page = 1, limit = 20 } = options;
  const skip = (page - 1) * Math.min(limit, 100);
  const take = Math.min(limit, 100);

  const where: any = {
    candidateProfileId,
  };

  if (minScore !== undefined) {
    where.overallScore = { gte: minScore };
  }

  if (status) {
    where.status = status;
  }

  if (jobId) {
    where.jobId = jobId;
  }

  const [matches, total] = await Promise.all([
    prisma.jobMatch.findMany({
      where,
      orderBy: [{ overallScore: 'desc' }, { updatedAt: 'desc' }],
      skip,
      take,
      include: {
        job: {
          select: {
            id: true,
            title: true,
            company: true,
            location: true,
            remoteType: true,
            employmentType: true,
            salaryMin: true,
            salaryMax: true,
            salaryCurrency: true,
            postedAt: true,
            status: true,
            skills: true,
          },
        },
      },
    }),
    prisma.jobMatch.count({ where }),
  ]);

  return {
    matches,
    pagination: {
      total,
      page,
      limit: take,
      pages: Math.ceil(total / take),
    },
  };
}

export async function getMatchById(matchId: string, candidateProfileId: string) {
  const match = await prisma.jobMatch.findUnique({
    where: { id: matchId },
    include: {
      job: true,
    },
  });

  if (!match) {
    throw new NotFoundError('Match record not found');
  }

  if (match.candidateProfileId !== candidateProfileId) {
    throw new NotFoundError('Match record not found');
  }

  return match;
}
