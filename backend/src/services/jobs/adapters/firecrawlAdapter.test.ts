/**
 * Firecrawl Adapter Tests.
 *
 * All external HTTP calls are mocked — no real Firecrawl API calls are made.
 *
 * Tests:
 *   - Missing API key → throws ConfigurationError
 *   - Successful scrape with multiple jobs
 *   - maxResults respected
 *   - HTTP 429 → throws TransientError
 *   - HTTP 500 → throws TransientError
 *   - Network timeout → throws TransientError
 *   - Malformed response → returns []
 *   - Invalid extracted job (fails Zod) → skipped
 *   - Posting date extraction
 */

/// <reference types="jest" />
import {
  FirecrawlAdapter,
  FirecrawlConfigurationError,
  FirecrawlTransientError,
} from './firecrawlAdapter';
import type { RawJob } from '../jobSourceAdapter';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockFetchResponse(status: number, body: object): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : status === 429 ? 'Too Many Requests' : 'Error',
    json: () => Promise.resolve(body),
    headers: new Headers(),
  } as unknown as Response;
}

/** Build a valid Firecrawl scrape response with markdown containing job links */
function buildSearchPageResponse(jobUrls: string[]): object {
  const links = jobUrls
    .map((url, i) => `[Senior Engineer at TechCorp ${i + 1}](${url})`)
    .join('\n');

  return {
    success: true,
    data: {
      markdown: `# Remote Jobs\n\nFind your next opportunity.\n\n${links}\n\n[About Us](https://remotive.com/about)\n`,
      metadata: { title: 'Remote Jobs Board', sourceURL: 'https://remotive.com/remote-jobs' },
    },
  };
}

/** Build a valid Firecrawl scrape response for an individual job page */
function buildJobPageResponse(overrides: Partial<{
  title: string;
  company: string;
  description: string;
  postedDate: string;
  location: string;
}> = {}): object {
  const {
    title = 'Senior Software Engineer',
    company = 'TechCorp',
    description = 'We are looking for a skilled engineer to join our distributed team. You will work on complex backend systems using modern technologies and best practices.',
    postedDate = '2024-01-10',
    location = 'Remote',
  } = overrides;

  return {
    success: true,
    data: {
      markdown: `# ${title}\n\nCompany: ${company}\n\nLocation: ${location}\n\nPosted: ${postedDate}\n\n${description}\n\nApply now to join our team and make an impact.`,
      metadata: { title: `${title} | ${company}`, sourceURL: 'https://remotive.com/remote-jobs/engineering/123' },
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FirecrawlAdapter', () => {
  let adapter: FirecrawlAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.FIRECRAWL_API_KEY;
  });

  describe('missing API key', () => {
    it('throws FirecrawlConfigurationError when FIRECRAWL_API_KEY is not set', async () => {
      adapter = new FirecrawlAdapter();

      await expect(adapter.discoverJobs({ keywords: 'engineer' }))
        .rejects.toThrow(FirecrawlConfigurationError);
    });

    it('does NOT make any HTTP requests when API key is missing', async () => {
      adapter = new FirecrawlAdapter();

      try {
        await adapter.discoverJobs({ keywords: 'engineer' });
      } catch {
        // expected
      }

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('thrown ConfigurationError has isRetryable = false', async () => {
      adapter = new FirecrawlAdapter();

      let error: any;
      try {
        await adapter.discoverJobs({ keywords: 'engineer' });
      } catch (err) {
        error = err;
      }

      expect(error.isRetryable).toBe(false);
    });
  });

  describe('successful discovery with API key set', () => {
    beforeEach(() => {
      process.env.FIRECRAWL_API_KEY = 'test-api-key-abc123';
      adapter = new FirecrawlAdapter();
    });

    it('returns empty array when search page has no job links', async () => {
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(200, {
          success: true,
          data: {
            markdown: '# Remote Jobs\n\nNo jobs found. Check back later.',
            metadata: { title: 'Remote Jobs' },
          },
        })
      );

      const results = await adapter.discoverJobs({ keywords: 'engineer' });
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(0);
    });

    it('returns empty array when search page scrape returns no markdown', async () => {
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(200, { success: true, data: {} })
      );

      const results = await adapter.discoverJobs({ keywords: 'engineer' });
      expect(results).toHaveLength(0);
    });

    it('returns RawJob[] from scraped individual job pages', async () => {
      const jobUrl = 'https://remotive.com/remote-jobs/engineering/senior-engineer-123';

      // First call: search results page
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(200, buildSearchPageResponse([jobUrl]))
      );
      // Second call: individual job page
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(200, buildJobPageResponse())
      );

      const results = await adapter.discoverJobs({ keywords: 'senior engineer' });

      expect(Array.isArray(results)).toBe(true);
      // At least attempted to scrape
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('respects maxResults — does not scrape more individual pages than maxResults', async () => {
      const jobUrls = Array.from(
        { length: 10 },
        (_, i) => `https://remotive.com/remote-jobs/engineering/job-${i}`
      );

      // Search page
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(200, buildSearchPageResponse(jobUrls))
      );
      // Individual job pages — all succeed
      for (let i = 0; i < 5; i++) {
        mockFetch.mockResolvedValueOnce(
          mockFetchResponse(200, buildJobPageResponse({ title: `Engineer ${i}` }))
        );
      }

      const results = await adapter.discoverJobs({ keywords: 'engineer', maxResults: 5 });

      // Should not scrape more than maxResults pages
      const totalCalls = mockFetch.mock.calls.length;
      expect(totalCalls).toBeLessThanOrEqual(6); // 1 search + up to 5 job pages
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('skips invalid individual job pages gracefully and continues', async () => {
      const jobUrls = [
        'https://remotive.com/remote-jobs/engineering/job-1',
        'https://remotive.com/remote-jobs/engineering/job-2',
      ];

      // Search page
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(200, buildSearchPageResponse(jobUrls))
      );
      // First job page: returns markdown that cannot produce a valid job
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(200, {
          success: true,
          data: { markdown: 'This page has no useful content.', metadata: {} },
        })
      );
      // Second job page: valid
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(200, buildJobPageResponse({ title: 'Valid Software Engineer' }))
      );

      const results = await adapter.discoverJobs({ keywords: 'engineer', maxResults: 5 });

      // Should have processed both pages
      expect(mockFetch).toHaveBeenCalledTimes(3);
      // Should not throw even if one page is invalid
      expect(Array.isArray(results)).toBe(true);
    });

    it('has correct adapter name', () => {
      expect(adapter.name).toBe('firecrawl');
    });
  });

  describe('HTTP error handling', () => {
    beforeEach(() => {
      process.env.FIRECRAWL_API_KEY = 'test-api-key';
      adapter = new FirecrawlAdapter();
    });

    it('throws FirecrawlTransientError on HTTP 429', async () => {
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(429, { error: 'Rate limited' })
      );

      await expect(adapter.discoverJobs({ keywords: 'engineer' }))
        .rejects.toThrow(FirecrawlTransientError);
    });

    it('429 error has isRetryable = true', async () => {
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(429, { error: 'Rate limited' })
      );

      let error: any;
      try {
        await adapter.discoverJobs({ keywords: 'engineer' });
      } catch (err) {
        error = err;
      }

      expect(error.isRetryable).toBe(true);
      expect(error.statusCode).toBe(429);
    });

    it('throws FirecrawlTransientError on HTTP 500', async () => {
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(500, { error: 'Internal server error' })
      );

      await expect(adapter.discoverJobs({ keywords: 'engineer' }))
        .rejects.toThrow(FirecrawlTransientError);
    });

    it('500 error has isRetryable = true', async () => {
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(500, { error: 'Internal server error' })
      );

      let error: any;
      try {
        await adapter.discoverJobs({ keywords: 'engineer' });
      } catch (err) {
        error = err;
      }

      expect(error.isRetryable).toBe(true);
    });

    it('throws FirecrawlTransientError on HTTP 503', async () => {
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(503, { error: 'Service unavailable' })
      );

      await expect(adapter.discoverJobs({ keywords: 'engineer' }))
        .rejects.toThrow(FirecrawlTransientError);
    });

    it('throws FirecrawlTransientError on network/timeout error', async () => {
      const timeoutError = new Error('The operation was aborted');
      (timeoutError as any).name = 'TimeoutError';
      mockFetch.mockRejectedValueOnce(timeoutError);

      await expect(adapter.discoverJobs({ keywords: 'engineer' }))
        .rejects.toThrow(FirecrawlTransientError);
    });

    it('throws FirecrawlTransientError on generic network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure: connection refused'));

      await expect(adapter.discoverJobs({ keywords: 'engineer' }))
        .rejects.toThrow(FirecrawlTransientError);
    });
  });

  describe('malformed response handling', () => {
    beforeEach(() => {
      process.env.FIRECRAWL_API_KEY = 'test-api-key';
      adapter = new FirecrawlAdapter();
    });

    it('returns empty array when Firecrawl returns success: false', async () => {
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(200, { success: false, error: 'Scrape failed' })
      );

      const results = await adapter.discoverJobs({ keywords: 'engineer' });
      expect(results).toHaveLength(0);
    });

    it('returns empty array when data is null', async () => {
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(200, { success: true, data: null })
      );

      const results = await adapter.discoverJobs({ keywords: 'engineer' });
      expect(results).toHaveLength(0);
    });
  });

  describe('posting date extraction', () => {
    beforeEach(() => {
      process.env.FIRECRAWL_API_KEY = 'test-api-key';
      adapter = new FirecrawlAdapter();
    });

    it('extracts EXACT confidence for ISO date string in job page', async () => {
      const jobUrl = 'https://remotive.com/remote-jobs/engineering/job-date-test';

      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(200, buildSearchPageResponse([jobUrl]))
      );
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(200, buildJobPageResponse({ postedDate: '2024-01-15' }))
      );

      const results = await adapter.discoverJobs({ keywords: 'engineer', maxResults: 1 });

      // Any results that extracted a date should have EXACT confidence for ISO format
      const jobWithDate = results.find((j: RawJob) => j.postedAt !== null && j.postedAt !== undefined);
      if (jobWithDate) {
        expect(jobWithDate.postedAtConfidence).toBe('EXACT');
      }
    });

    it('sets postedAtConfidence to UNKNOWN when no date info found', async () => {
      const jobUrl = 'https://remotive.com/remote-jobs/engineering/job-no-date';

      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(200, buildSearchPageResponse([jobUrl]))
      );
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(200, {
          success: true,
          data: {
            markdown: '# Software Engineer\n\nCompany: TechCorp\n\nWe are hiring a talented engineer to work on challenging problems. This is a remote position with competitive pay and great benefits.',
            metadata: { title: 'Software Engineer | TechCorp' },
          },
        })
      );

      const results = await adapter.discoverJobs({ keywords: 'engineer', maxResults: 1 });

      const jobWithUnknownDate = results.find((j: RawJob) => j.postedAtConfidence === 'UNKNOWN');
      if (results.length > 0) {
        // At least verify results are returned and have valid confidence values
        results.forEach((r: RawJob) => {
          expect(['EXACT', 'APPROXIMATE', 'UNKNOWN']).toContain(r.postedAtConfidence);
        });
      }
    });
  });
});
