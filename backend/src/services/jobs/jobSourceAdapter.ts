/**
 * Job Source Adapter — Interface and RawJob contract.
 *
 * Every external job source must implement the JobSource interface and produce
 * RawJob objects that pass Zod validation before being processed further.
 *
 * NEVER trust external source data — always validate through RawJobSchema.
 */

import { z } from 'zod';

// ─── RawJob Zod Schema ─────────────────────────────────────────────────────────

/**
 * Normalized internal contract for a single job from any external source.
 * All fields except title/company/jobUrl/source are optional.
 */
export const RawJobSchema = z.object({
  title: z.string().min(1).max(500),
  company: z.string().min(1).max(500),
  description: z.string().optional().nullable(),
  jobUrl: z.string().url().max(2000),
  source: z.string().min(1).max(100),
  sourceJobId: z.string().max(500).optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  remoteType: z.enum(['REMOTE', 'HYBRID', 'ONSITE', 'UNKNOWN']).optional().default('UNKNOWN'),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY', 'UNKNOWN']).optional().default('UNKNOWN'),
  salaryMin: z.number().int().positive().optional().nullable(),
  salaryMax: z.number().int().positive().optional().nullable(),
  salaryCurrency: z.string().max(10).optional().nullable(),
  /**
   * postedAt must only be set when the adapter can provide a reliable timestamp.
   * Never set this to "now" or "today" unless the source confirms it.
   */
  postedAt: z.string().datetime().optional().nullable(),
  /**
   * EXACT   – source gave a reliable timestamp/date
   * APPROXIMATE – source gave "2 hours ago", "Today", etc.
   * UNKNOWN – no usable date information from source
   */
  postedAtConfidence: z.enum(['EXACT', 'APPROXIMATE', 'UNKNOWN']).optional().default('UNKNOWN'),
  skills: z.array(z.string().max(200)).optional().default([]),
  companyUrl: z.string().url().max(2000).optional().nullable(),
});

export type RawJob = z.infer<typeof RawJobSchema>;

// ─── Discovery Input ───────────────────────────────────────────────────────────

export interface JobDiscoveryInput {
  /** Search keywords, e.g. "senior react developer" */
  keywords: string;
  /** Optional location string, e.g. "New York" or "Remote" */
  location?: string;
  /** Maximum number of results to fetch (adapter may cap this) */
  maxResults?: number;
}

// ─── JobSource Interface ───────────────────────────────────────────────────────

/**
 * All external job sources must implement this interface.
 * This allows adding new sources (Indeed, LinkedIn, Greenhouse, etc.) without
 * changing the ingestion pipeline.
 */
export interface JobSource {
  /** Unique identifier for this source, e.g. "firecrawl" */
  readonly name: string;

  /**
   * Discover jobs from the external source.
   *
   * Return semantics:
   *   - Returns RawJob[] (may be empty) on success.
   *   - MUST THROW for transient failures (timeout, HTTP 429, 5xx, network error)
   *     so that BullMQ can retry the job with exponential backoff.
   *   - MUST THROW a non-retryable error for configuration failures (e.g. missing API key)
   *     so the caller can distinguish config problems from transient ones.
   *   - MAY log + skip individual invalid results without failing the whole call.
   *
   * The ingestion pipeline remains source-agnostic: adapters must not leak
   * provider-specific structures beyond this boundary.
   */
  discoverJobs(input: JobDiscoveryInput): Promise<RawJob[]>;
}
