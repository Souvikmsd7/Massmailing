/**
 * Job Discovery Worker.
 *
 * BullMQ worker for the "job-discovery" queue.
 *
 * The Queue definition is centralized in jobDiscoveryService.ts.
 * This file only defines the Worker that consumes from that queue.
 *
 * Error propagation semantics:
 *   - Transient source errors (FirecrawlTransientError) → rethrow → BullMQ retries
 *   - Config errors (FirecrawlConfigurationError)       → rethrow → BullMQ marks failed (no retry benefit)
 *   - Invalid individual jobs (validation failures)     → logged, counted in stats
 *   - Ingestion layer errors                           → rethrow → BullMQ retries
 */

import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../utils/logger';
import { JobSource } from '../services/jobs/jobSourceAdapter';
import { FirecrawlAdapter, FirecrawlConfigurationError } from '../services/jobs/adapters/firecrawlAdapter';
import { ingestJobs, IngestionStats } from '../services/jobs/jobIngestionService';
import { jobDiscoveryQueue } from '../services/jobs/jobDiscoveryService';

export { jobDiscoveryQueue };

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function createRedisConnection() {
  return new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
}

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
      const logContext = {
        jobId: job.id,
        keywords: input.keywords,
        location: input.location,
        sources,
        attempt: job.attemptsMade + 1,
      };

      logger.info('[JobDiscoveryWorker] Processing discovery job', logContext);

      const aggregatedStats: IngestionStats = {
        received: 0,
        invalid: 0,
        duplicate: 0,
        created: 0,
        updated: 0,
        errors: 0,
      };

      for (const sourceName of sources) {
        const adapter = adapters[sourceName];
        if (!adapter) {
          logger.warn(`[JobDiscoveryWorker] Source adapter "${sourceName}" not registered`, logContext);
          continue;
        }

        logger.info(`[JobDiscoveryWorker] Fetching jobs from ${adapter.name}`, logContext);

        // Note: do NOT catch transient errors here — let them propagate so BullMQ can retry.
        // Configuration errors are also propagated — there is no benefit in retrying them, but
        // BullMQ will mark the job failed so operators can see the problem.
        let rawJobs;
        try {
          rawJobs = await adapter.discoverJobs(input);
        } catch (err) {
          if (err instanceof FirecrawlConfigurationError) {
            // Non-retryable config error — log clearly and propagate
            logger.error(
              `[JobDiscoveryWorker] Configuration error in source ${sourceName} — operator action required`,
              logContext,
              err
            );
          } else {
            // Transient error — propagate to trigger BullMQ retry
            logger.warn(
              `[JobDiscoveryWorker] Transient error in source ${sourceName} — will retry`,
              logContext
            );
          }
          throw err; // Always rethrow — BullMQ handles retry decisions
        }

        logger.info(`[JobDiscoveryWorker] ${adapter.name} returned ${rawJobs.length} raw jobs`, logContext);

        // Ingestion failures are propagated — they are likely transient (DB issues)
        const stats = await ingestJobs(rawJobs);

        aggregatedStats.received += stats.received;
        aggregatedStats.invalid += stats.invalid;
        aggregatedStats.duplicate += stats.duplicate;
        aggregatedStats.created += stats.created;
        aggregatedStats.updated += stats.updated;
        aggregatedStats.errors += stats.errors;
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
    logger.error('[JobDiscoveryWorker] Worker-level error', {}, err);
  });

  worker.on('failed', (job, err) => {
    logger.error('[JobDiscoveryWorker] Job failed', {
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
    }, err);
  });

  worker.on('completed', (job, result) => {
    logger.info('[JobDiscoveryWorker] Job completed successfully', {
      jobId: job.id,
      stats: result,
    });
  });

  logger.info('[JobDiscoveryWorker] Job discovery worker started');
}
