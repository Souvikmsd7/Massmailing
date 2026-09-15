/**
 * Job Deduplication Layer.
 *
 * Priority order (as specified in phase-2.md §10):
 *   1. source + sourceJobId  (unique constraint in DB)
 *   2. canonical jobUrl      (normalized URL)
 *   3. contentHash           (SHA-256 of key fields)
 *
 * The pipeline is idempotent — running the same discovery twice must not
 * create duplicate records.
 */

import crypto from 'crypto';
import { NormalizedJob } from './jobNormalizer';

// ─── URL Normalization ─────────────────────────────────────────────────────────

/**
 * Normalize a URL for comparison — strips tracking params and trailing slashes.
 */
export function normalizeJobUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove common tracking query params
    const TRACKING_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'src'];
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }
    // Normalize to lowercase host + lowercase path (no trailing slash)
    const normalized = `${parsed.protocol}//${parsed.host.toLowerCase()}${parsed.pathname.replace(/\/$/, '')}${parsed.search}`;
    return normalized;
  } catch {
    // If URL is malformed, return as-is trimmed
    return url.trim();
  }
}

// ─── Content Hash ──────────────────────────────────────────────────────────────

/**
 * Generate a deterministic SHA-256 content hash from key job fields.
 * This is the deduplication key of last resort.
 *
 * Fields used:
 *   - normalizedTitle (lowercase)
 *   - company (lowercase)
 *   - normalizedLocation (lowercase, or "")
 *   - first 500 chars of description (lowercase, or "")
 *
 * This intentionally excludes postedAt and source to catch cross-source duplicates.
 */
export function generateContentHash(job: Pick<NormalizedJob, 'normalizedTitle' | 'company' | 'normalizedLocation' | 'description'>): string {
  const payload = [
    job.normalizedTitle.toLowerCase().trim(),
    job.company.toLowerCase().trim(),
    (job.normalizedLocation ?? '').toLowerCase().trim(),
    (job.description ?? '').toLowerCase().trim().slice(0, 500),
  ].join('||');

  return crypto.createHash('sha256').update(payload).digest('hex');
}

// ─── Deduplication Result ──────────────────────────────────────────────────────

export interface DeduplicatedJob extends NormalizedJob {
  contentHash: string;
  normalizedJobUrl: string;
}

/**
 * Enrich a normalized job with its deduplication keys.
 */
export function buildDeduplicatedJob(job: NormalizedJob): DeduplicatedJob {
  return {
    ...job,
    contentHash: generateContentHash(job),
    normalizedJobUrl: normalizeJobUrl(job.jobUrl),
  };
}
