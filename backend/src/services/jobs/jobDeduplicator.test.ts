import { generateContentHash, normalizeJobUrl, buildDeduplicatedJob } from './jobDeduplicator';
import { NormalizedJob } from './jobNormalizer';

describe('jobDeduplicator', () => {
  describe('generateContentHash', () => {
    it('produces identical hash for identical normalized job content', () => {
      const hash1 = generateContentHash({
        normalizedTitle: 'Senior Software Engineer',
        company: 'Acme Corp',
        normalizedLocation: 'San Francisco, CA',
        description: 'Build awesome apps',
      });
      const hash2 = generateContentHash({
        normalizedTitle: 'senior software engineer',
        company: 'Acme Corp',
        normalizedLocation: 'san francisco, ca',
        description: 'build awesome apps',
      });

      expect(hash1).toBe(hash2);
    });

    it('produces different hash for different content', () => {
      const hash1 = generateContentHash({
        normalizedTitle: 'Senior Software Engineer',
        company: 'Acme Corp',
        normalizedLocation: null,
        description: null,
      });
      const hash2 = generateContentHash({
        normalizedTitle: 'Junior Software Engineer',
        company: 'Acme Corp',
        normalizedLocation: null,
        description: null,
      });

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('normalizeJobUrl', () => {
    it('strips tracking query params from job URLs', () => {
      const url = 'https://company.com/careers/job-123?utm_source=linkedin&ref=board#apply';
      expect(normalizeJobUrl(url)).toBe('https://company.com/careers/job-123');
    });

    it('lowercases protocol and domain', () => {
      const url = 'HTTPS://Company.COM/Careers/Job-123';
      expect(normalizeJobUrl(url)).toBe('https://company.com/Careers/Job-123');
    });
  });

  describe('buildDeduplicatedJob', () => {
    const baseJob: NormalizedJob = {
      title: 'Backend Engineer',
      normalizedTitle: 'Backend Engineer',
      description: 'Node.js backend work',
      company: 'TechCorp',
      companyUrl: null,
      jobUrl: 'https://techcorp.com/jobs/456?ref=board',
      source: 'firecrawl',
      sourceJobId: 'fc-456',
      location: 'Remote',
      normalizedLocation: 'Remote',
      remoteType: 'REMOTE',
      employmentType: 'FULL_TIME',
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      postedAt: null,
      postedAtConfidence: 'EXACT',
      skills: ['Node.js', 'PostgreSQL'],
    };

    it('enriches normalized job with contentHash and normalizedJobUrl', () => {
      const result = buildDeduplicatedJob(baseJob);

      expect(result.contentHash).toBeDefined();
      expect(result.contentHash.length).toBe(64); // SHA-256
      expect(result.normalizedJobUrl).toBe('https://techcorp.com/jobs/456');
    });
  });
});
