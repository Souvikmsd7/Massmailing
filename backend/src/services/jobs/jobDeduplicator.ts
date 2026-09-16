/**
 * Job Deduplication Layer.
 *
 * Priority order (as specified in phase-2.md §10):
 *   1. source + sourceJobId  (unique constraint in DB)
 *   2. canonical jobUrl      (normalized URL, persisted as canonicalJobUrl)
 *   3. contentHash           (SHA-256 of key fields)
 *
 * The pipeline is idempotent — running the same discovery twice must not
 * create duplicate records.
 */

import crypto from 'crypto';
import { NormalizedJob } from './jobNormalizer';

// ─── Tracking params to strip ──────────────────────────────────────────────────

const TRACKING_PARAMS = [
  // UTM params
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  // Social/ad tracking
  'fbclid',
  'gclid',
  // Common referral params (non-job-identifying)
  'ref',
  'src',
];

// Default ports that should be stripped from canonical URLs
const DEFAULT_PORTS: Record<string, string> = {
  'http:': '80',
  'https:': '443',
};

// ─── URL Normalization ─────────────────────────────────────────────────────────

/**
 * Normalize a URL for canonical deduplication comparison.
 *
 * Normalization steps:
 *   1. Parse URL
 *   2. Lowercase hostname
 *   3. Remove default ports (80 for http, 443 for https)
 *   4. Remove trailing slash from pathname (unless it's the root "/")
 *   5. Remove known tracking query parameters
 *   6. Leave all other query params intact (they may identify the actual job)
 *
 * NOTE: Two genuinely different jobs with different paths/non-tracking-params
 * will never be considered duplicates by URL alone.
 *
 * @param url Raw job URL from source
 * @returns Canonical URL string; returns trimmed input if URL is malformed
 */
export function normalizeJobUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // 1. Lowercase hostname
    parsed.hostname = parsed.hostname.toLowerCase();

    // 2. Remove default ports
    const defaultPort = DEFAULT_PORTS[parsed.protocol];
    if (defaultPort && parsed.port === defaultPort) {
      parsed.port = '';
    }

    // 3. Remove tracking query params
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }

    // 4. Build canonical string: remove trailing slash from path (keep root '/')
    const pathname = parsed.pathname.length > 1
      ? parsed.pathname.replace(/\/+$/, '')
      : parsed.pathname;

    // Reconstruct — use sorted search params for consistent ordering
    parsed.searchParams.sort();

    const search = parsed.searchParams.toString() ? `?${parsed.searchParams.toString()}` : '';
    const hash = ''; // Strip fragments — they're client-side only

    return `${parsed.protocol}//${parsed.host}${pathname}${search}${hash}`;
  } catch {
    // If URL is malformed, return trimmed as-is (will still be stored, just won't dedup by URL)
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
  /** Normalized/canonical URL for DB-level deduplication. Persisted as canonicalJobUrl. */
  canonicalJobUrl: string;
}

/**
 * Enrich a normalized job with its deduplication keys.
 * Both keys are persisted to the database.
 */
export function buildDeduplicatedJob(job: NormalizedJob): DeduplicatedJob {
  return {
    ...job,
    contentHash: generateContentHash(job),
    canonicalJobUrl: normalizeJobUrl(job.jobUrl),
  };
}
