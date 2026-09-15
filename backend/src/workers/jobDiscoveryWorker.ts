/**
 * Job Discovery Worker.
 *
 * BullMQ worker for the "job-discovery" queue.
 * Processes discovery tasks by running source adapters and passing raw jobs
 * through the ingestion pipeline (validation -> normalization -> dedup -> DB).
 */

import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../utils/logger';
import { JobSource } from '../services/jobs/jobSourceAdapter';
import { FirecrawlAdapter } from '../services/jobs/adapters/firecrawlAdapter';
import { ingestJobs, IngestionStats } from '../services/jobs/jobIngestionService';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function createRedisConnection() {
  return new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
}

export const jobDiscoveryQueue = new Queue('job-discovery', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});

export interface DiscoveryJobData {
  input: {
    keywords: string;
    location?: string;
    maxResults?: number;
  };
  sources?: string[];
}

const adapters: Record<string, JobSource> = {
  firecrawl: new FirecrawlAdapter(),
};

let worker: Worker | null = null;

export function startJobDiscoveryWorker(): void {
  if (worker) return;

  worker = new Worker<DiscoveryJobData>(
    'job-discovery',
    async (job: Job<DiscoveryJobData>) => {
      const { input, sources = ['firecrawl'] } = job.data;
      const logContext = { jobId: job.id, keywords: input.keywords, location: input.location, sources };

      logger.info('[JobDiscoveryWorker] Processing discovery job', logContext);

      const aggregatedStats: IngestionStats = {
        received: 0,
        invalid: 0,
        duplicate: 0,
        created: 0,
        errors: 0,
      };

      for (const sourceName of sources) {
        try {
          const adapter = adapters[sourceName];
          if (!adapter) {
            logger.warn(`[JobDiscoveryWorker] Source adapter "${sourceName}" not registered`, logContext);
            continue;
          }

          logger.info(`[JobDiscoveryWorker] Fetching jobs from ${adapter.name}`, logContext);
          const rawJobs = await adapter.discoverJobs(input);

          logger.info(`[JobDiscoveryWorker] ${adapter.name} returned ${rawJobs.length} raw jobs`, logContext);

          const stats = await ingestJobs(rawJobs);

          aggregatedStats.received += stats.received;
          aggregatedStats.invalid += stats.invalid;
          aggregatedStats.duplicate += stats.duplicate;
          aggregatedStats.created += stats.created;
          aggregatedStats.errors += stats.errors;
        } catch (err) {
          logger.error(`[JobDiscoveryWorker] Error processing source ${sourceName}`, logContext, err as Error);
        }
      }

      logger.info('[JobDiscoveryWorker] Discovery job completed', {
        ...logContext,
        stats: aggregatedStats,
      });

      return aggregatedStats;
    },
    {
      connection: createRedisConnection(),
      concurrency: 2,
    }
  );

  worker.on('error', (err) => {
    logger.error('[JobDiscoveryWorker] Queue error', {}, err);
  });

  logger.info('[JobDiscoveryWorker] Job discovery worker started');
}
