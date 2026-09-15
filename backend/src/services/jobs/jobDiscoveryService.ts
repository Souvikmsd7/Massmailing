/**
 * Job Discovery Service.
 *
 * Responsibilities:
 * - Maintain adapter registry
 * - Enqueue discovery jobs to BullMQ "job-discovery" queue
 * - Expose job list/detail queries
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { JobDiscoveryInput } from './jobSourceAdapter';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function createRedisConnection() {
  return new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
}

export const jobDiscoveryQueue = new Queue('job-discovery', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 50,
    removeOnFail: 50,
  },
});

export interface DiscoveryJobData {
  input: JobDiscoveryInput;
  /** Which source adapters to run. Defaults to all registered adapters. */
  sources?: string[];
}

/**
 * Enqueue a job discovery task.
 * Returns the BullMQ job ID immediately — does NOT wait for completion.
 */
export async function enqueueDiscovery(data: DiscoveryJobData): Promise<string> {
  const job = await jobDiscoveryQueue.add('discover', data);
  logger.info('[JobDiscoveryService] Enqueued discovery job', {
    bullmqJobId: job.id,
    keywords: data.input.keywords,
    location: data.input.location,
  });
  return job.id!;
}

// ─── Job Query Filters ─────────────────────────────────────────────────────────

export interface JobFilters {
  keyword?: string;
  location?: string;
  remoteType?: string;
  employmentType?: string;
  source?: string;
  /** e.g. "24h", "7d", "30d" */
  postedWithin?: string;
  company?: string;
  page?: number;
  limit?: number;
}

function parsePostedWithinMs(value: string): number | null {
  const match = value.match(/^(\d+)(h|d)$/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return match[2] === 'h' ? n * 60 * 60 * 1000 : n * 24 * 60 * 60 * 1000;
}

/**
 * List jobs with optional filtering.
 *
 * postedWithin filter: only applies to jobs where postedAtConfidence is EXACT or APPROXIMATE.
 * Jobs with UNKNOWN confidence are excluded from "within N hours" filtering to avoid
 * falsely representing them as recently posted.
 */
export async function listJobs(filters: JobFilters = {}) {
  const { keyword, location, remoteType, employmentType, source, postedWithin, company, page = 1, limit = 20 } = filters;
  const skip = (page - 1) * Math.min(limit, 100);
  const take = Math.min(limit, 100);

  const where: Prisma.JobWhereInput = {
    status: 'ACTIVE',
  };

  if (keyword) {
    where.OR = [
      { normalizedTitle: { contains: keyword, mode: 'insensitive' } },
      { company: { contains: keyword, mode: 'insensitive' } },
      { description: { contains: keyword, mode: 'insensitive' } },
    ];
  }

  if (location) {
    where.normalizedLocation = { contains: location, mode: 'insensitive' };
  }

  if (company) {
    where.company = { contains: company, mode: 'insensitive' };
  }

  if (remoteType && ['REMOTE', 'HYBRID', 'ONSITE', 'UNKNOWN'].includes(remoteType)) {
    where.remoteType = remoteType as any;
  }

  if (employmentType && ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY', 'UNKNOWN'].includes(employmentType)) {
    where.employmentType = employmentType as any;
  }

  if (source) {
    where.source = source;
  }

  if (postedWithin) {
    const ms = parsePostedWithinMs(postedWithin);
    if (ms !== null) {
      const cutoff = new Date(Date.now() - ms);
      where.AND = [
        { postedAtConfidence: { not: 'UNKNOWN' } },
        { postedAt: { gte: cutoff } },
      ];
    }
  }

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: [{ discoveredAt: 'desc' }, { postedAt: 'desc' }],
      skip,
      take,
      select: {
        id: true,
        title: true,
        normalizedTitle: true,
        company: true,
        companyUrl: true,
        jobUrl: true,
        source: true,
        location: true,
        normalizedLocation: true,
        remoteType: true,
        employmentType: true,
        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
        postedAt: true,
        postedAtConfidence: true,
        discoveredAt: true,
        status: true,
        skills: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.job.count({ where }),
  ]);

  return {
    jobs,
    pagination: {
      total,
      page,
      limit: take,
      pages: Math.ceil(total / take),
    },
  };
}

/**
 * Get a single job by ID.
 */
export async function getJobById(jobId: string) {
  return prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      title: true,
      normalizedTitle: true,
      description: true,
      company: true,
      companyUrl: true,
      jobUrl: true,
      source: true,
      sourceJobId: true,
      location: true,
      normalizedLocation: true,
      remoteType: true,
      employmentType: true,
      salaryMin: true,
      salaryMax: true,
      salaryCurrency: true,
      postedAt: true,
      postedAtConfidence: true,
      discoveredAt: true,
      status: true,
      skills: true,
      createdAt: true,
      updatedAt: true,
      // contentHash NOT exposed — internal dedup key only
    },
  });
}
