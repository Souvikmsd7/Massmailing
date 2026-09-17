/**
 * Job Matching Worker.
 *
 * Background BullMQ worker listening on "job-matching" queue.
 * Performs asynchronous matching and recalculations.
 */

import { Queue, Worker, Job as BullJob } from 'bullmq';
import IORedis from 'ioredis';
import { calculateJobMatch } from '../services/matching/jobMatchService';
import { logger } from '../utils/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function createRedisConnection() {
  return new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
}

export const jobMatchingQueue = new Queue('job-matching', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});

export interface JobMatchingJobData {
  candidateProfileId: string;
  jobId: string;
  forceRecalculate?: boolean;
}

export async function processMatchingJob(job: BullJob<JobMatchingJobData>): Promise<void> {
  const { candidateProfileId, jobId, forceRecalculate } = job.data;
  logger.info('[JobMatchingWorker] Processing match calculation job', { candidateProfileId, jobId });

  await calculateJobMatch(candidateProfileId, jobId, { forceRecalculate });
}

export function startJobMatchingWorker(): Worker<JobMatchingJobData> | null {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

  const worker = new Worker<JobMatchingJobData>(
    'job-matching',
    async (job) => {
      await processMatchingJob(job);
    },
    {
      connection: createRedisConnection(),
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    logger.info('[JobMatchingWorker] Job completed', { bullmqJobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error(`[JobMatchingWorker] Job failed`, { bullmqJobId: job?.id }, err);
  });

  logger.info('[JobMatchingWorker] Worker started');
  return worker;
}
