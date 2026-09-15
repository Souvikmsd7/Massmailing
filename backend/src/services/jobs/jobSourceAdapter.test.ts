import { RawJobSchema } from './jobSourceAdapter';
import { FirecrawlAdapter } from './adapters/firecrawlAdapter';

describe('jobSourceAdapter & FirecrawlAdapter', () => {
  describe('RawJobSchema Zod validation', () => {
    it('validates a correct RawJob object', () => {
      const valid = {
        title: 'Software Engineer',
        company: 'Stripe',
        jobUrl: 'https://stripe.com/jobs/1',
        source: 'firecrawl',
        postedAtConfidence: 'EXACT',
      };

      const result = RawJobSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects RawJob missing required title', () => {
      const invalid = {
        company: 'Stripe',
        jobUrl: 'https://stripe.com/jobs/1',
        source: 'firecrawl',
      };

      const result = RawJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects invalid jobUrl', () => {
      const invalid = {
        title: 'Software Engineer',
        company: 'Stripe',
        jobUrl: 'not-a-valid-url',
        source: 'firecrawl',
      };

      const result = RawJobSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('defaults postedAtConfidence to UNKNOWN if omitted', () => {
      const obj = {
        title: 'Engineer',
        company: 'Tech',
        jobUrl: 'https://tech.com/1',
        source: 'manual',
      };

      const parsed = RawJobSchema.parse(obj);
      expect(parsed.postedAtConfidence).toBe('UNKNOWN');
    });
  });

  describe('FirecrawlAdapter safety contract', () => {
    it('returns empty array when FIRECRAWL_API_KEY is missing without throwing', async () => {
      delete process.env.FIRECRAWL_API_KEY;
      const adapter = new FirecrawlAdapter();

      const results = await adapter.discoverJobs({ keywords: 'Node.js' });
      expect(Array.isArray(results)).toBe(true);
      expect(results).toEqual([]);
    });

    it('has name "firecrawl"', () => {
      const adapter = new FirecrawlAdapter();
      expect(adapter.name).toBe('firecrawl');
    });
  });
});
