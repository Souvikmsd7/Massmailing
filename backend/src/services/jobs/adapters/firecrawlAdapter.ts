/**
 * Firecrawl Job Source Adapter.
 *
 * Uses the Firecrawl API to scrape job listings from public job board pages.
 *
 * DISCOVERY FLOW:
 *   1. Call Firecrawl /scrape on a job search results page
 *   2. Parse the markdown to extract individual job listing URLs
 *   3. Scrape each individual job page (up to maxResults)
 *   4. Extract structured job data from each page's markdown
 *   5. Return validated RawJob[]
 *
 * May return fewer jobs than maxResults if the source provides fewer valid listings.
 *
 * ERROR CONTRACT:
 *   - Missing API key         → throws ConfigurationError (non-retryable)
 *   - HTTP 429 / 5xx          → throws TransientError (BullMQ will retry)
 *   - Network timeout         → throws TransientError (BullMQ will retry)
 *   - Invalid individual page → logged and skipped (non-fatal)
 *
 * POSTED DATE POLICY:
 *   - Clear ISO datetime      → postedAtConfidence = EXACT
 *   - Relative ("2 days ago") → postedAtConfidence = APPROXIMATE, approximate timestamp
 *   - No date info            → postedAtConfidence = UNKNOWN, postedAt = null
 *
 * SAFETY CONTRACT:
 *   - Firecrawl API key stays server-side, never exposed to clients
 *   - No arbitrary URL fetching — the adapter controls which URLs are fetched
 *   - Never bypasses CAPTCHA, auth, or anti-bot protections
 */

import { JobSource, JobDiscoveryInput, RawJob, RawJobSchema } from '../jobSourceAdapter';
import { logger } from '../../../utils/logger';

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1';
const FIRECRAWL_TIMEOUT_MS = 30_000;

// ─── Custom Error Classes ──────────────────────────────────────────────────────

/**
 * Thrown when the Firecrawl adapter is misconfigured (e.g. missing API key).
 * These errors should NOT be retried by BullMQ.
 */
export class FirecrawlConfigurationError extends Error {
  readonly isRetryable = false;
  constructor(message: string) {
    super(message);
    this.name = 'FirecrawlConfigurationError';
  }
}

/**
 * Thrown for transient Firecrawl failures (rate limits, 5xx, network issues).
 * BullMQ WILL retry these.
 */
export class FirecrawlTransientError extends Error {
  readonly isRetryable = true;
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'FirecrawlTransientError';
  }
}

// ─── Firecrawl API Response Types ─────────────────────────────────────────────

interface FirecrawlScrapeResult {
  success: boolean;
  data?: {
    markdown?: string;
    metadata?: { title?: string; description?: string; sourceURL?: string };
  };
  error?: string;
}

// ─── Posted Date Parsing ───────────────────────────────────────────────────────

/**
 * Attempt to parse a relative date string like "2 days ago" into an ISO timestamp.
 * Returns { date, confidence } — confidence is APPROXIMATE for relative strings,
 * UNKNOWN if unparseable.
 */
function parseRelativeDate(relative: string): { date: string | null; confidence: 'APPROXIMATE' | 'UNKNOWN' } {
  const lower = relative.toLowerCase().trim();
  const now = new Date();

  if (lower === 'today' || lower === 'just now' || lower === 'less than a day ago') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return { date: d.toISOString(), confidence: 'APPROXIMATE' };
  }

  const daysMatch = lower.match(/(\d+)\s+day[s]?\s+ago/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    d.setHours(0, 0, 0, 0);
    return { date: d.toISOString(), confidence: 'APPROXIMATE' };
  }

  const hoursMatch = lower.match(/(\d+)\s+hour[s]?\s+ago/);
  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1], 10);
    const d = new Date(now.getTime() - hours * 60 * 60 * 1000);
    return { date: d.toISOString(), confidence: 'APPROXIMATE' };
  }

  const weeksMatch = lower.match(/(\d+)\s+week[s]?\s+ago/);
  if (weeksMatch) {
    const weeks = parseInt(weeksMatch[1], 10);
    const d = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
    d.setHours(0, 0, 0, 0);
    return { date: d.toISOString(), confidence: 'APPROXIMATE' };
  }

  return { date: null, confidence: 'UNKNOWN' };
}

/**
 * Attempt to extract a posting date from markdown text.
 * Returns null if no usable date is found.
 */
function extractPostedDate(markdown: string): { postedAt: string | null; confidence: 'EXACT' | 'APPROXIMATE' | 'UNKNOWN' } {
  // Look for ISO datetime strings
  const isoMatch = markdown.match(/\b(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?(?:[+-]\d{2}:\d{2})?)\b/);
  if (isoMatch) {
    try {
      const d = new Date(isoMatch[1]);
      if (!isNaN(d.getTime()) && d.getFullYear() > 2000 && d <= new Date()) {
        return { postedAt: d.toISOString(), confidence: 'EXACT' };
      }
    } catch {
      // ignore malformed
    }
  }

  // Look for YYYY-MM-DD date strings
  const dateMatch = markdown.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (dateMatch) {
    try {
      const d = new Date(dateMatch[1] + 'T00:00:00.000Z');
      if (!isNaN(d.getTime()) && d.getFullYear() > 2000 && d <= new Date()) {
        return { postedAt: d.toISOString(), confidence: 'EXACT' };
      }
    } catch {
      // ignore
    }
  }

  // Look for relative date strings
  const relativePatterns = [
    /posted\s+(today|just now|\d+\s+(?:hour|day|week)s?\s+ago)/i,
    /(today|just now|\d+\s+(?:hour|day|week)s?\s+ago)/i,
  ];

  for (const pattern of relativePatterns) {
    const match = markdown.match(pattern);
    if (match) {
      const result = parseRelativeDate(match[1]);
      if (result.date) {
        return { postedAt: result.date, confidence: result.confidence };
      }
    }
  }

  return { postedAt: null, confidence: 'UNKNOWN' };
}

// ─── Job URL Extraction ────────────────────────────────────────────────────────

/**
 * Extract job listing URLs from a job search results page markdown.
 * Looks for markdown links that appear to point to individual job listings.
 *
 * Returns up to `maxResults` discovered URLs.
 */
function extractJobUrlsFromMarkdown(markdown: string, baseUrl: string, maxResults: number): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  // Match markdown links: [text](url)
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(markdown)) !== null && urls.length < maxResults * 3) {
    const linkText = match[1];
    const url = match[2];

    // Filter: URL should look like a job posting link (not navigation/meta links)
    if (isLikelyJobUrl(url, linkText) && !seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  return urls.slice(0, maxResults);
}

/**
 * Heuristic: is this URL likely an individual job posting page?
 *
 * Strategy:
 *   - Reject obvious navigation/meta URLs by path prefix
 *   - Accept URLs that contain strong job-related path segments
 *   - For ambiguous paths, require BOTH link text to look like a job title
 *     AND the URL to have a meaningful path depth (not just domain root)
 *   - Never accept URLs whose only signal is short link text
 */
function isLikelyJobUrl(url: string, linkText: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();

    // ── Negative list: skip obvious non-job pages ──────────────────────────
    const skipPrefixes = [
      '/',
      '/about',
      '/contact',
      '/login',
      '/signin',
      '/signup',
      '/register',
      '/logout',
      '/blog',
      '/press',
      '/news',
      '/privacy',
      '/terms',
      '/cookie',
      '/faq',
      '/help',
      '/support',
      '/pricing',
      '/features',
      '/solutions',
      '/product',
      '/company',
      '/team',
      '/culture',
      '/diversity',
      '/investors',
      '/legal',
      '/security',
      '/accessibility',
      '/sitemap',
    ];

    if (path === '/' || skipPrefixes.some((p) => path === p || path.startsWith(p + '/'))) {
      return false;
    }

    // Skip fragment-only or query-only pseudo-URLs
    if (path === '' || path.length < 2) return false;

    // Skip obvious tag/category archive pages
    if (path.includes('/tag/') || path.includes('/category/') || path.includes('/topic/')) {
      return false;
    }

    // ── Strong positive signals: URL path contains job-specific segment ─────
    const strongJobPathPatterns = [
      /\/jobs?\//i,
      /\/positions?\//i,
      /\/careers?\//i,
      /\/openings?\//i,
      /\/roles?\//i,
      /\/vacancies?\//i,
      /\/listings?\//i,
      /\/apply\//i,
      /\/work-at\//i,
      /\/join\//i,
      /\/opportunities?\//i,
    ];

    if (strongJobPathPatterns.some((p) => p.test(path))) return true;

    // Also accept if query params contain job-specific identifiers
    const jobQueryPatterns = [/[?&]job_?id=/i, /[?&]jid=/i, /[?&]gh_jid=/i, /[?&]lever-origin=/i];
    if (jobQueryPatterns.some((p) => p.test(url))) return true;

    // ── Weak signal: URL path ends in a slug that LOOKS like a job title ────
    // Require BOTH a meaningful path depth AND link text that looks like a job title
    const pathDepth = path.split('/').filter(Boolean).length;
    const lastSegment = path.split('/').filter(Boolean).pop() ?? '';

    const textLooksLikeJobTitle =
      linkText.length >= 10 &&
      linkText.length <= 150 &&
      // Must contain at least one word (not just numbers or special chars)
      /[a-zA-Z]{3,}/.test(linkText) &&
      // Should not look like a navigation label
      !/^(home|about|contact|login|sign\s?up|sign\s?in|menu|nav|search|see\s+all|view\s+all|load\s+more|next|prev|back|more|apply|submit|confirm|cancel|close)$/i.test(
        linkText.trim()
      );

    const pathLooksLikeJobSlug =
      pathDepth >= 2 &&
      lastSegment.length >= 5 &&
      // Slug contains a mix of words (not just an ID number)
      /[a-zA-Z]/.test(lastSegment);

    return textLooksLikeJobTitle && pathLooksLikeJobSlug;
  } catch {
    return false;
  }
}

// ─── Job Extraction from Markdown ─────────────────────────────────────────────

/**
 * Extract structured job data from the markdown content of an individual job page.
 * Conservative — returns null if critical fields cannot be reliably extracted.
 *
 * This is intentionally deterministic (no LLM required for Phase 2).
 */
function extractJobFromMarkdown(
  markdown: string,
  sourceUrl: string,
  source: string,
  pageMetadata?: { title?: string; description?: string }
): RawJob | null {
  try {
    const lines = markdown.split('\n').map((l) => l.trim()).filter(Boolean);

    // Title: prefer page H1/H2, fall back to metadata title
    let title: string | undefined;
    const titleLine = lines.find((l) => /^#{1,3}\s/.test(l));
    if (titleLine) {
      title = titleLine.replace(/^#{1,3}\s+/, '').trim();
    } else if (pageMetadata?.title) {
      // Strip common suffixes like "| Company Name | Jobs"
      title = pageMetadata.title
        .replace(/\s*[\|–-]\s*.+$/, '')
        .trim();
    }

    if (!title || title.length < 2) return null;

    // Company: look for common patterns
    let company = 'Unknown Company';
    const companyLine = lines.find((l) =>
      /^(?:company|employer|organization|hiring|posted by|at)\s*[:–-]/i.test(l)
    );
    if (companyLine) {
      company = companyLine.replace(/^.*?[:–-]\s*/, '').trim() || company;
    } else {
      // Try extracting from title "Job Title at Company Name"
      const atMatch = title.match(/\bat\s+(.+)$/i);
      if (atMatch) {
        company = atMatch[1].trim();
        title = title.replace(/\bat\s+.+$/i, '').trim();
      }
    }

    // Description: collect substantial paragraphs (not headings, not nav links)
    const descriptionLines = lines
      .filter((l) => l.length > 60 && !l.startsWith('#') && !l.startsWith('[') && !l.startsWith('|'))
      .slice(0, 5)
      .join(' ')
      .slice(0, 2000);

    const description = descriptionLines.length > 20 ? descriptionLines : null;

    // Location
    let location: string | null = null;
    const locationLine = lines.find((l) => /^(?:location|city|based in)\s*[:–-]/i.test(l));
    if (locationLine) {
      location = locationLine.replace(/^.*?[:–-]\s*/, '').trim() || null;
    }

    // Remote type
    let remoteType: 'REMOTE' | 'HYBRID' | 'ONSITE' | 'UNKNOWN' = 'UNKNOWN';
    const fullText = lines.join(' ');
    if (/\bfully\s+remote\b|\bwork\s+from\s+home\b|\bremote\s+only\b/i.test(fullText)) {
      remoteType = 'REMOTE';
    } else if (/\bhybrid\b/i.test(fullText)) {
      remoteType = 'HYBRID';
    } else if (/\bon[- ]?site\b|\bin[- ]?office\b|\bin[- ]?person\b/i.test(fullText)) {
      remoteType = 'ONSITE';
    } else if (/\bremote\b/i.test(fullText)) {
      remoteType = 'REMOTE';
    }

    // Posted date
    const { postedAt, confidence: postedAtConfidence } = extractPostedDate(markdown);

    const rawJob: RawJob = {
      title,
      company,
      description,
      jobUrl: sourceUrl,
      source,
      sourceJobId: null,
      location,
      remoteType,
      employmentType: 'UNKNOWN',
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      postedAt,
      postedAtConfidence,
      skills: [],
      companyUrl: null,
    };

    const parsed = RawJobSchema.safeParse(rawJob);
    if (!parsed.success) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

// ─── FirecrawlAdapter ──────────────────────────────────────────────────────────

export class FirecrawlAdapter implements JobSource {
  readonly name = 'firecrawl';

  private readonly apiKey: string | null;

  constructor() {
    this.apiKey = process.env.FIRECRAWL_API_KEY ?? null;
  }

  /**
   * Discover jobs from Firecrawl.
   *
   * Flow:
   *   1. Scrape a job search results page
   *   2. Extract individual job URLs from the results page markdown
   *   3. Scrape each job page individually (up to maxResults)
   *   4. Return RawJob[] — validated and ready for ingestion
   *
   * Throws FirecrawlConfigurationError for missing API key (non-retryable).
   * Throws FirecrawlTransientError for 429/5xx/timeout (BullMQ will retry).
   */
  async discoverJobs(input: JobDiscoveryInput): Promise<RawJob[]> {
    if (!this.apiKey) {
      // Non-retryable — operator must configure the key
      throw new FirecrawlConfigurationError(
        '[FirecrawlAdapter] FIRECRAWL_API_KEY is not configured. Set the environment variable to enable Firecrawl job discovery.'
      );
    }

    const { keywords, location, maxResults = 10 } = input;

    // Build search URL — Remotive for remote jobs
    const searchUrl = location
      ? `https://remotive.com/remote-jobs/${encodeURIComponent(keywords.toLowerCase().replace(/\s+/g, '-'))}`
      : `https://remotive.com/remote-jobs/software-dev?search=${encodeURIComponent(keywords)}`;

    logger.info('[FirecrawlAdapter] Scraping search results page', { searchUrl, maxResults });

    // Step 1: scrape the search results page (throws on transient errors)
    const searchResult = await this.scrapeUrl(searchUrl);

    if (!searchResult.success || !searchResult.data?.markdown) {
      // Non-fatal: source returned no usable data (e.g. empty results page)
      logger.warn('[FirecrawlAdapter] Search results page returned no usable markdown', { searchUrl });
      return [];
    }

    // Step 2: extract individual job URLs
    const jobUrls = extractJobUrlsFromMarkdown(searchResult.data.markdown, searchUrl, maxResults);
    logger.info(`[FirecrawlAdapter] Extracted ${jobUrls.length} candidate job URLs from results page`, { count: jobUrls.length });

    if (jobUrls.length === 0) {
      // Non-fatal: source page parsed successfully but no job links found
      logger.warn('[FirecrawlAdapter] No job URLs found in search results — source page format may have changed', { searchUrl });
      return [];
    }

    // Step 3: scrape each individual job page
    const results: RawJob[] = [];

    for (const jobUrl of jobUrls) {
      if (results.length >= maxResults) break;

      try {
        const jobPageResult = await this.scrapeUrl(jobUrl);

        if (!jobPageResult.success || !jobPageResult.data?.markdown) {
          logger.warn('[FirecrawlAdapter] Job page scrape returned no usable markdown — skipping', { jobUrl });
          continue;
        }

        const job = extractJobFromMarkdown(
          jobPageResult.data.markdown,
          jobUrl,
          this.name,
          jobPageResult.data.metadata
        );

        if (job) {
          results.push(job);
        } else {
          logger.warn('[FirecrawlAdapter] Could not extract job from page — skipping', { jobUrl });
        }
      } catch (err) {
        // If an individual job page scrape hits a transient error, rethrow
        // so BullMQ can retry the whole discovery job
        if (err instanceof FirecrawlTransientError) {
          logger.warn('[FirecrawlAdapter] Transient error scraping individual job page — propagating', { jobUrl });
          throw err;
        }
        // Other individual-page errors are skipped
        logger.warn('[FirecrawlAdapter] Error scraping individual job page — skipping', { jobUrl, error: (err as Error)?.message });
      }
    }

    logger.info(`[FirecrawlAdapter] Discovery complete`, { found: results.length, maxResults });
    return results;
  }

  /**
   * Scrape a single URL via the Firecrawl API.
   *
   * @throws FirecrawlTransientError for HTTP 429, 5xx, timeout, network error
   */
  private async scrapeUrl(url: string): Promise<FirecrawlScrapeResult> {
    let response: Response;

    try {
      response = await fetch(`${FIRECRAWL_API_URL}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          url,
          formats: ['markdown'],
          onlyMainContent: true,
        }),
        signal: AbortSignal.timeout(FIRECRAWL_TIMEOUT_MS),
      });
    } catch (err: any) {
      // Network failure or timeout — transient
      const message = err?.name === 'TimeoutError'
        ? `[FirecrawlAdapter] Request timed out after ${FIRECRAWL_TIMEOUT_MS}ms for URL: ${url}`
        : `[FirecrawlAdapter] Network error scraping URL: ${url} — ${err?.message}`;
      throw new FirecrawlTransientError(message);
    }

    if (!response.ok) {
      // HTTP errors
      if (response.status === 429) {
        throw new FirecrawlTransientError(
          `[FirecrawlAdapter] Rate limited (HTTP 429) — will retry`,
          429
        );
      }
      if (response.status >= 500) {
        throw new FirecrawlTransientError(
          `[FirecrawlAdapter] Firecrawl server error (HTTP ${response.status}) — will retry`,
          response.status
        );
      }
      // 4xx other than 429 — not transient, but also not a config error
      throw new Error(`[FirecrawlAdapter] Unexpected HTTP ${response.status} for URL: ${url}`);
    }

    return response.json() as Promise<FirecrawlScrapeResult>;
  }
}
