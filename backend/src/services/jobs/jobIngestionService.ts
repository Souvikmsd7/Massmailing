/**
 * Job Ingestion Service.
 *
 * Pipeline: RawJob[] → validate → normalize → deduplicate → upsert to DB
 *
 * Returns ingestion statistics with clear semantics:
 *   - created:   job was new and inserted
 *   - updated:   job existed (matched by any dedup key) and mutable fields changed
 *   - duplicate: job existed and nothing changed
 *   - invalid:   raw job failed Zod validation
 *   - errors:    unexpected persistence failures
 *
 * Deduplication priority:
 *   1. source + sourceJobId  (unique constraint)
 *   2. canonicalJobUrl       (tracking-stripped URL)
 *   3. contentHash           (SHA-256 of title+company+location+description)
 */

import { PrismaClient } from '@prisma/client';
import { RawJob, RawJobSchema } from './jobSourceAdapter';
import { normalizeJob } from './jobNormalizer';
import { buildDeduplicatedJob, DeduplicatedJob } from './jobDeduplicator';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

export interface IngestionStats {
  received: number;
  invalid: number;
  duplicate: number;
  created: number;
  updated: number;
  errors: number;
}

/**
 * Find an existing Job record using deduplication priority:
 *   1. source + sourceJobId
 *   2. canonicalJobUrl
 *   3. contentHash
 *
 * Returns the existing record or null if genuinely new.
 */
async function findExistingJob(deduped: DeduplicatedJob) {
  // Priority 1: source + sourceJobId
  if (deduped.sourceJobId) {
    const existing = await prisma.job.findUnique({
      where: { source_sourceJobId: { source: deduped.source, sourceJobId: deduped.sourceJobId } },
    });
    if (existing) return existing;
  }

  // Priority 2: canonical URL (non-null only — malformed URLs remain empty string)
  if (deduped.canonicalJobUrl) {
    const existing = await prisma.job.findFirst({
      where: { canonicalJobUrl: deduped.canonicalJobUrl },
    });
    if (existing) return existing;
  }

  // Priority 3: content hash
  return prisma.job.findUnique({
    where: { contentHash: deduped.contentHash },
  });
}

/**
 * Ingest a batch of raw jobs.
 *
 * Steps per job:
 *   1. Zod-validate the raw job
 *   2. Normalize fields
 *   3. Compute deduplication keys
 *   4. Check for existing record (by priority)
 *   5. Create or update
 */
export async function ingestJobs(rawJobs: RawJob[]): Promise<IngestionStats> {
  const stats: IngestionStats = {
    received: rawJobs.length,
    invalid: 0,
    duplicate: 0,
    created: 0,
    updated: 0,
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

      // 4. Check for existing record (deterministic — no timestamp comparison)
      const existing = await findExistingJob(deduped);

      if (!existing) {
        // 5a. New job — create
        await prisma.job.create({
          data: {
            title: deduped.title,
            normalizedTitle: deduped.normalizedTitle,
            description: deduped.description,
            company: deduped.company,
            companyUrl: deduped.companyUrl,
            jobUrl: deduped.jobUrl,
            canonicalJobUrl: deduped.canonicalJobUrl || null,
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
        });
        stats.created++;
      } else {
        // 5b. Existing job — check if anything meaningful changed
        const hasChanges =
          existing.contentHash !== deduped.contentHash ||
          existing.status !== 'ACTIVE' ||
          JSON.stringify(existing.skills) !== JSON.stringify(deduped.skills);

        if (hasChanges) {
          await prisma.job.update({
            where: { id: existing.id },
            data: {
              // Update mutable fields
              status: 'ACTIVE',
              skills: deduped.skills,
              // Only improve postedAt confidence — never downgrade
              ...(deduped.postedAtConfidence === 'EXACT' ||
                (deduped.postedAtConfidence === 'APPROXIMATE' && existing.postedAtConfidence === 'UNKNOWN')
                ? {
                    postedAt: deduped.postedAt,
                    postedAtConfidence: deduped.postedAtConfidence,
                  }
                : {}),
              // Keep canonicalJobUrl if not already set
              ...(existing.canonicalJobUrl === null && deduped.canonicalJobUrl
                ? { canonicalJobUrl: deduped.canonicalJobUrl }
                : {}),
            },
          });
          stats.updated++;
        } else {
          stats.duplicate++;
        }
      }
    } catch (err: any) {
      // Handle race-condition unique constraint violation (P2002)
      // Another process inserted the same job between our findExistingJob check and create
      if (err?.code === 'P2002') {
        logger.warn('[JobIngestion] Race condition duplicate — skipping', {
          source: (raw as any)?.source,
        });
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
