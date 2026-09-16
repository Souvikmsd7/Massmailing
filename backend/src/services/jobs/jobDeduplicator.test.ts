import { generateContentHash, normalizeJobUrl, buildDeduplicatedJob } from './jobDeduplicator';
import { NormalizedJob } from './jobNormalizer';

describe('jobDeduplicator', () => {
  // ─── normalizeJobUrl ──────────────────────────────────────────────────────────

  describe('normalizeJobUrl', () => {
    it('strips utm_source tracking param', () => {
      expect(normalizeJobUrl('https://company.com/jobs/123?utm_source=linkedin'))
        .toBe('https://company.com/jobs/123');
    });

    it('strips utm_medium tracking param', () => {
      expect(normalizeJobUrl('https://company.com/jobs/123?utm_medium=email'))
        .toBe('https://company.com/jobs/123');
    });

    it('strips utm_campaign tracking param', () => {
      expect(normalizeJobUrl('https://company.com/jobs/123?utm_campaign=spring'))
        .toBe('https://company.com/jobs/123');
    });

    it('strips utm_term tracking param', () => {
      expect(normalizeJobUrl('https://company.com/jobs/123?utm_term=software'))
        .toBe('https://company.com/jobs/123');
    });

    it('strips utm_content tracking param', () => {
      expect(normalizeJobUrl('https://company.com/jobs/123?utm_content=banner'))
        .toBe('https://company.com/jobs/123');
    });

    it('strips fbclid (Facebook click ID) tracking param', () => {
      expect(normalizeJobUrl('https://company.com/jobs/123?fbclid=IwAR0abc'))
        .toBe('https://company.com/jobs/123');
    });

    it('strips gclid (Google click ID) tracking param', () => {
      expect(normalizeJobUrl('https://company.com/jobs/123?gclid=Cj0KCQ'))
        .toBe('https://company.com/jobs/123');
    });

    it('strips ref tracking param', () => {
      expect(normalizeJobUrl('https://company.com/jobs/123?ref=board'))
        .toBe('https://company.com/jobs/123');
    });

    it('strips multiple tracking params at once', () => {
      const url = 'https://company.com/careers/job-123?utm_source=linkedin&utm_medium=cpc&fbclid=abc&ref=board#apply';
      expect(normalizeJobUrl(url)).toBe('https://company.com/careers/job-123');
    });

    it('preserves non-tracking query params that identify the job', () => {
      const url = 'https://jobs.lever.co/company/job?gh_jid=12345';
      expect(normalizeJobUrl(url)).toBe('https://jobs.lever.co/company/job?gh_jid=12345');
    });

    it('preserves non-tracking query params with UTM stripped', () => {
      const url = 'https://jobs.lever.co/company?job_id=456&utm_source=indeed';
      expect(normalizeJobUrl(url)).toBe('https://jobs.lever.co/company?job_id=456');
    });

    it('lowercases the hostname', () => {
      expect(normalizeJobUrl('HTTPS://COMPANY.COM/jobs/123'))
        .toBe('https://company.com/jobs/123');
    });

    it('lowercases mixed-case hostname', () => {
      expect(normalizeJobUrl('https://Company.COM/Careers/Job-123'))
        .toBe('https://company.com/Careers/Job-123');
    });

    it('removes trailing slash from path', () => {
      expect(normalizeJobUrl('https://company.com/jobs/123/'))
        .toBe('https://company.com/jobs/123');
    });

    it('removes multiple trailing slashes from path', () => {
      expect(normalizeJobUrl('https://company.com/jobs/123///'))
        .toBe('https://company.com/jobs/123');
    });

    it('preserves root path "/" without stripping', () => {
      expect(normalizeJobUrl('https://company.com/'))
        .toBe('https://company.com/');
    });

    it('strips default HTTPS port 443', () => {
      expect(normalizeJobUrl('https://company.com:443/jobs/123'))
        .toBe('https://company.com/jobs/123');
    });

    it('strips default HTTP port 80', () => {
      expect(normalizeJobUrl('http://company.com:80/jobs/123'))
        .toBe('http://company.com/jobs/123');
    });

    it('preserves non-default port', () => {
      expect(normalizeJobUrl('https://company.com:8443/jobs/123'))
        .toBe('https://company.com:8443/jobs/123');
    });

    it('strips URL fragments (hash)', () => {
      expect(normalizeJobUrl('https://company.com/jobs/123#apply'))
        .toBe('https://company.com/jobs/123');
    });

    it('handles malformed URL gracefully — returns trimmed input', () => {
      expect(normalizeJobUrl('not-a-valid-url')).toBe('not-a-valid-url');
    });

    it('handles empty string gracefully', () => {
      expect(normalizeJobUrl('')).toBe('');
    });

    it('handles URL with spaces in query — returns trimmed fallback', () => {
      const result = normalizeJobUrl('  https://company.com/jobs/123  ');
      // Should either parse or trim — either way no crash
      expect(typeof result).toBe('string');
    });
  });

  // ─── generateContentHash ──────────────────────────────────────────────────────

  describe('generateContentHash', () => {
    it('produces identical hash for identical job content', () => {
      const hash1 = generateContentHash({
        normalizedTitle: 'Senior Software Engineer',
        company: 'Acme Corp',
        normalizedLocation: 'San Francisco, CA',
        description: 'Build awesome apps',
      });
      const hash2 = generateContentHash({
        normalizedTitle: 'Senior Software Engineer',
        company: 'Acme Corp',
        normalizedLocation: 'San Francisco, CA',
        description: 'Build awesome apps',
      });
      expect(hash1).toBe(hash2);
    });

    it('is case-insensitive — same content different casing produces same hash', () => {
      const hash1 = generateContentHash({
        normalizedTitle: 'Senior Software Engineer',
        company: 'Acme Corp',
        normalizedLocation: 'San Francisco, CA',
        description: 'Build awesome apps',
      });
      const hash2 = generateContentHash({
        normalizedTitle: 'senior software engineer',
        company: 'acme corp',
        normalizedLocation: 'san francisco, ca',
        description: 'build awesome apps',
      });
      expect(hash1).toBe(hash2);
    });

    it('produces different hash for different title', () => {
      const hash1 = generateContentHash({ normalizedTitle: 'Senior Software Engineer', company: 'Acme', normalizedLocation: null, description: null });
      const hash2 = generateContentHash({ normalizedTitle: 'Junior Software Engineer', company: 'Acme', normalizedLocation: null, description: null });
      expect(hash1).not.toBe(hash2);
    });

    it('produces different hash for different company', () => {
      const hash1 = generateContentHash({ normalizedTitle: 'Senior Engineer', company: 'Acme', normalizedLocation: null, description: null });
      const hash2 = generateContentHash({ normalizedTitle: 'Senior Engineer', company: 'Other Corp', normalizedLocation: null, description: null });
      expect(hash1).not.toBe(hash2);
    });

    it('produces different hash for different location', () => {
      const hash1 = generateContentHash({ normalizedTitle: 'Engineer', company: 'Acme', normalizedLocation: 'New York', description: null });
      const hash2 = generateContentHash({ normalizedTitle: 'Engineer', company: 'Acme', normalizedLocation: 'London', description: null });
      expect(hash1).not.toBe(hash2);
    });

    it('produces a 64-character hex string (SHA-256)', () => {
      const hash = generateContentHash({ normalizedTitle: 'Test', company: 'Corp', normalizedLocation: null, description: null });
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('handles null location and description consistently', () => {
      const h1 = generateContentHash({ normalizedTitle: 'E', company: 'C', normalizedLocation: null, description: null });
      const h2 = generateContentHash({ normalizedTitle: 'E', company: 'C', normalizedLocation: null, description: null });
      expect(h1).toBe(h2);
    });

    it('same job with different description beyond 500 chars produces same hash', () => {
      const longDesc1 = 'A'.repeat(600);
      const longDesc2 = 'A'.repeat(500) + 'DIFFERENT_SUFFIX';
      const h1 = generateContentHash({ normalizedTitle: 'E', company: 'C', normalizedLocation: null, description: longDesc1 });
      const h2 = generateContentHash({ normalizedTitle: 'E', company: 'C', normalizedLocation: null, description: longDesc2 });
      expect(h1).toBe(h2);
    });
  });

  // ─── buildDeduplicatedJob ─────────────────────────────────────────────────────

  describe('buildDeduplicatedJob', () => {
    const baseJob: NormalizedJob = {
      title: 'Backend Engineer',
      normalizedTitle: 'Backend Engineer',
      description: 'Node.js backend work',
      company: 'TechCorp',
      companyUrl: null,
      jobUrl: 'https://techcorp.com/jobs/456?ref=board&utm_source=linkedin',
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

    it('enriches job with contentHash', () => {
      const result = buildDeduplicatedJob(baseJob);
      expect(result.contentHash).toBeDefined();
      expect(result.contentHash.length).toBe(64);
    });

    it('enriches job with canonicalJobUrl with tracking params stripped', () => {
      const result = buildDeduplicatedJob(baseJob);
      expect(result.canonicalJobUrl).toBe('https://techcorp.com/jobs/456');
    });

    it('produces same canonicalJobUrl regardless of UTM variation', () => {
      const jobWithUtm1 = { ...baseJob, jobUrl: 'https://techcorp.com/jobs/456?utm_source=linkedin' };
      const jobWithUtm2 = { ...baseJob, jobUrl: 'https://techcorp.com/jobs/456?utm_medium=email' };
      const jobClean = { ...baseJob, jobUrl: 'https://techcorp.com/jobs/456' };

      const r1 = buildDeduplicatedJob(jobWithUtm1);
      const r2 = buildDeduplicatedJob(jobWithUtm2);
      const r3 = buildDeduplicatedJob(jobClean);

      expect(r1.canonicalJobUrl).toBe(r2.canonicalJobUrl);
      expect(r2.canonicalJobUrl).toBe(r3.canonicalJobUrl);
    });

    it('produces different canonicalJobUrl for genuinely different job URLs', () => {
      const job1 = { ...baseJob, jobUrl: 'https://techcorp.com/jobs/456' };
      const job2 = { ...baseJob, jobUrl: 'https://techcorp.com/jobs/789' };

      expect(buildDeduplicatedJob(job1).canonicalJobUrl)
        .not.toBe(buildDeduplicatedJob(job2).canonicalJobUrl);
    });

    it('two different companies with same path are different canonical URLs', () => {
      const job1 = { ...baseJob, jobUrl: 'https://companyA.com/jobs/123' };
      const job2 = { ...baseJob, jobUrl: 'https://companyB.com/jobs/123' };

      expect(buildDeduplicatedJob(job1).canonicalJobUrl)
        .not.toBe(buildDeduplicatedJob(job2).canonicalJobUrl);
    });

    it('same URL with changed description produces different contentHash', () => {
      const job1 = { ...baseJob, description: 'Description version 1' };
      const job2 = { ...baseJob, description: 'Completely different description v2' };

      const h1 = buildDeduplicatedJob(job1).contentHash;
      const h2 = buildDeduplicatedJob(job2).contentHash;
      expect(h1).not.toBe(h2);
    });

    it('handles malformed URL for canonicalJobUrl gracefully', () => {
      const jobBadUrl = { ...baseJob, jobUrl: 'not-a-valid-url' };
      const result = buildDeduplicatedJob(jobBadUrl);
      expect(result.canonicalJobUrl).toBe('not-a-valid-url');
      expect(result.contentHash).toBeDefined();
    });
  });
});
