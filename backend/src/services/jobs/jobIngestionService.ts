/**
 * Job Ingestion Service.
 *
 * Pipeline: RawJob[] → validate → normalize → deduplicate → upsert to DB
 *
 * Returns ingestion statistics.
 */

import { PrismaClient } from '@prisma/client';
import { RawJob, RawJobSchema } from './jobSourceAdapter';
import { normalizeJob } from './jobNormalizer';
import { buildDeduplicatedJob } from './jobDeduplicator';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

export interface IngestionStats {
  received: number;
  invalid: number;
  duplicate: number;
  created: number;
  errors: number;
}

/**
 * Ingest a batch of raw jobs:
 * 1. Zod-validate each RawJob
 * 2. Normalize fields
 * 3. Compute deduplication keys
 * 4. Upsert to DB (ON CONFLICT → skip)
 */
export async function ingestJobs(rawJobs: RawJob[]): Promise<IngestionStats> {
  const stats: IngestionStats = {
    received: rawJobs.length,
    invalid: 0,
    duplicate: 0,
    created: 0,
    errors: 0,
  };

  for (const raw of rawJobs) {
    try {
      // 1. Validate
      const validated = RawJobSchema.safeParse(raw);
      if (!validated.success) {
        logger.warn('[JobIngestion] Invalid raw job — skipping', {
          issues: validated.error.issues.map((i) => i.message).join(', '),
          source: (raw as any)?.source,
        });
        stats.invalid++;
        continue;
      }

      // 2. Normalize
      const normalized = normalizeJob(validated.data);

      // 3. Deduplicate
      const deduped = buildDeduplicatedJob(normalized);

      // 4. Upsert — contentHash is UNIQUE, so conflict = existing record
      //    source+sourceJobId is also UNIQUE
      //    We use createMany with skipDuplicates for atomicity
      const result = await prisma.job.upsert({
        where: { contentHash: deduped.contentHash },
        create: {
          title: deduped.title,
          normalizedTitle: deduped.normalizedTitle,
          description: deduped.description,
          company: deduped.company,
          companyUrl: deduped.companyUrl,
          jobUrl: deduped.jobUrl,
          source: deduped.source,
          sourceJobId: deduped.sourceJobId,
          location: deduped.location,
          normalizedLocation: deduped.normalizedLocation,
          remoteType: deduped.remoteType,
          employmentType: deduped.employmentType,
          salaryMin: deduped.salaryMin,
          salaryMax: deduped.salaryMax,
          salaryCurrency: deduped.salaryCurrency,
          postedAt: deduped.postedAt,
          postedAtConfidence: deduped.postedAtConfidence,
          contentHash: deduped.contentHash,
          skills: deduped.skills,
          status: 'ACTIVE',
        },
        update: {
          // On re-discovery, update mutable fields but keep id/contentHash/discoveredAt
          status: 'ACTIVE',
          skills: deduped.skills,
          // Only update postedAt if we have more confidence than before
          ...(deduped.postedAtConfidence !== 'UNKNOWN' && {
            postedAt: deduped.postedAt,
            postedAtConfidence: deduped.postedAtConfidence,
          }),
        },
      });

      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        stats.created++;
      } else {
        stats.duplicate++;
      }
    } catch (err: any) {
      // Handle unique constraint violation on source+sourceJobId (Prisma P2002)
      if (err?.code === 'P2002') {
        stats.duplicate++;
      } else {
        logger.error('[JobIngestion] Unexpected error persisting job', {
          source: (raw as any)?.source,
        }, err as Error);
        stats.errors++;
      }
    }
  }

  logger.info('[JobIngestion] Ingestion complete', stats);
  return stats;
}
