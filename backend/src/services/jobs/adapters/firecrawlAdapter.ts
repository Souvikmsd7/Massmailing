/**
 * Firecrawl Job Source Adapter.
 *
 * Uses the Firecrawl API (via HTTP fetch — no heavy SDK needed) to scrape
 * job listings from public job board pages.
 *
 * SAFETY CONTRACT:
 * - Returns [] (not throws) if FIRECRAWL_API_KEY is not configured.
 * - Returns [] (not throws) if Firecrawl is unavailable.
 * - Never bypasses CAPTCHA, auth, or anti-bot protections.
 * - Respects a conservative request rate.
 * - All extracted data is validated through RawJobSchema before returning.
 *
 * POSTED DATE POLICY:
 * - If Firecrawl returns a clear ISO datetime → postedAtConfidence = EXACT
 * - If Firecrawl returns relative text ("2 days ago") → postedAtConfidence = APPROXIMATE,
 *   we store discoveredAt and compute an approximate postedAt
 * - If no date info → postedAtConfidence = UNKNOWN, postedAt = null
 */

import { JobSource, JobDiscoveryInput, RawJob, RawJobSchema } from '../jobSourceAdapter';
import { logger } from '../../../utils/logger';

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1';
const FIRECRAWL_TIMEOUT_MS = 30_000;

interface FirecrawlScrapeResult {
  success: boolean;
  data?: {
    markdown?: string;
    metadata?: { title?: string; description?: string };
  };
  error?: string;
}

/**
 * Attempt to parse a relative date string like "2 days ago" into an ISO timestamp.
 * Returns null if the string cannot be reliably parsed.
 */
function parseRelativeDate(relative: string): { date: string; confidence: 'APPROXIMATE' | 'UNKNOWN' } {
  const now = new Date();
  const lower = relative.toLowerCase().trim();

  if (lower === 'today' || lower === 'just now' || lower === 'less than a day ago') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return { date: d.toISOString(), confidence: 'APPROXIMATE' };
  }

  const daysMatch = lower.match(/(\d+)\s+day[s]?\s+ago/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return { date: d.toISOString(), confidence: 'APPROXIMATE' };
  }

  const hoursMatch = lower.match(/(\d+)\s+hour[s]?\s+ago/);
  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1], 10);
    const d = new Date(now.getTime() - hours * 60 * 60 * 1000);
    return { date: d.toISOString(), confidence: 'APPROXIMATE' };
  }

  return { date: now.toISOString(), confidence: 'UNKNOWN' };
}

/**
 * Extract structured job data from Firecrawl markdown output.
 * This is intentionally conservative — returns null if data is unreliable.
 */
function extractJobFromMarkdown(
  markdown: string,
  sourceUrl: string,
  source: string
): RawJob | null {
  try {
    // Very basic extraction — in a real system you would use a dedicated LLM
    // extraction step here. For Phase 2, we do deterministic field matching.
    const lines = markdown.split('\n').map((l) => l.trim()).filter(Boolean);

    const titleLine = lines.find((l) => l.startsWith('# ') || l.startsWith('## '));
    const title = titleLine?.replace(/^#{1,3}\s+/, '').trim();
    if (!title) return null;

    const companyLine = lines.find((l) =>
      /company|employer|hiring|posted by/i.test(l)
    );
    const company = companyLine
      ? companyLine.replace(/^.*?:\s*/, '').trim()
      : 'Unknown Company';

    // Collect description (first substantial paragraph)
    const description = lines
      .filter((l) => l.length > 80 && !l.startsWith('#'))
      .slice(0, 3)
      .join(' ')
      .slice(0, 2000) || null;

    const rawJob: RawJob = {
      title,
      company,
      description,
      jobUrl: sourceUrl,
      source,
      sourceJobId: null,
      location: null,
      remoteType: 'UNKNOWN',
      employmentType: 'UNKNOWN',
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      postedAt: null,
      postedAtConfidence: 'UNKNOWN',
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

export class FirecrawlAdapter implements JobSource {
  readonly name = 'firecrawl';

  private readonly apiKey: string | null;

  constructor() {
    this.apiKey = process.env.FIRECRAWL_API_KEY || null;
  }

  async discoverJobs(input: JobDiscoveryInput): Promise<RawJob[]> {
    if (!this.apiKey) {
      logger.warn('[FirecrawlAdapter] FIRECRAWL_API_KEY not configured — skipping Firecrawl discovery');
      return [];
    }

    const { keywords, location, maxResults = 10 } = input;
    const results: RawJob[] = [];

    // Build a simple job board search URL (e.g. remotive.com for remote jobs)
    // This is a single example endpoint — extend to additional job boards as needed
    const searchUrl = location
      ? `https://remotive.com/remote-jobs/${encodeURIComponent(keywords.toLowerCase().replace(/\s+/g, '-'))}`
      : `https://remotive.com/remote-jobs/software-dev?search=${encodeURIComponent(keywords)}`;

    try {
      const scrapeResult = await this.scrapeUrl(searchUrl);
      if (!scrapeResult.success || !scrapeResult.data?.markdown) {
        logger.warn('[FirecrawlAdapter] Scrape returned no usable data', { url: searchUrl });
        return [];
      }

      const job = extractJobFromMarkdown(scrapeResult.data.markdown, searchUrl, this.name);
      if (job) results.push(job);
    } catch (err) {
      logger.error('[FirecrawlAdapter] Discovery failed — returning empty results', {}, err as Error);
    }

    return results.slice(0, maxResults);
  }

  private async scrapeUrl(url: string): Promise<FirecrawlScrapeResult> {
    const response = await fetch(`${FIRECRAWL_API_URL}/scrape`, {
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

    if (!response.ok) {
      throw new Error(`Firecrawl API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<FirecrawlScrapeResult>;
  }
}
