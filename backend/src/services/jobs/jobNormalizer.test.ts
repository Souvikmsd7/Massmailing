import {
  normalizeJobTitle,
  normalizeLocation,
  normalizeRemoteType,
  normalizeEmploymentType,
  normalizeJobSkills,
  normalizeJob,
} from './jobNormalizer';
import { RawJob } from './jobSourceAdapter';

describe('jobNormalizer', () => {
  describe('normalizeJobTitle', () => {
    it('normalizes Sr. Software Engineer → Senior Software Engineer', () => {
      expect(normalizeJobTitle('Sr. Software Engineer')).toBe('Senior Software Engineer');
    });

    it('normalizes Fullstack Developer → Full Stack Developer', () => {
      expect(normalizeJobTitle('Fullstack Developer')).toBe('Full Stack Developer');
    });

    it('trims extra whitespace', () => {
      expect(normalizeJobTitle('  Frontend   Engineer  ')).toBe('Frontend Engineer');
    });
  });

  describe('normalizeLocation', () => {
    it('expands US state abbreviation NYC → New York, NY', () => {
      expect(normalizeLocation('NYC')).toBe('New York, NY');
    });

    it('expands SF → San Francisco, CA', () => {
      expect(normalizeLocation('SF')).toBe('San Francisco, CA');
    });

    it('returns null for empty location', () => {
      expect(normalizeLocation('')).toBeNull();
      expect(normalizeLocation(undefined)).toBeNull();
    });
  });

  describe('normalizeRemoteType', () => {
    it('detects remote from explicit string', () => {
      expect(normalizeRemoteType('Remote')).toBe('REMOTE');
      expect(normalizeRemoteType('Work from home')).toBe('REMOTE');
    });

    it('detects hybrid', () => {
      expect(normalizeRemoteType('Hybrid')).toBe('HYBRID');
    });

    it('detects onsite', () => {
      expect(normalizeRemoteType('Onsite')).toBe('ONSITE');
    });

    it('defaults to UNKNOWN if ambiguous', () => {
      expect(normalizeRemoteType(undefined)).toBe('UNKNOWN');
    });
  });

  describe('normalizeEmploymentType', () => {
    it('detects full-time', () => {
      expect(normalizeEmploymentType('Full Time')).toBe('FULL_TIME');
      expect(normalizeEmploymentType('full-time')).toBe('FULL_TIME');
    });

    it('detects contract', () => {
      expect(normalizeEmploymentType('Contractor')).toBe('CONTRACT');
    });

    it('detects internship', () => {
      expect(normalizeEmploymentType('Summer Intern')).toBe('INTERNSHIP');
    });

    it('defaults to UNKNOWN when undefined', () => {
      expect(normalizeEmploymentType(undefined)).toBe('UNKNOWN');
    });
  });

  describe('normalizeJobSkills', () => {
    it('normalizes skill array using Phase 1 skill normalizer', () => {
      const skills = normalizeJobSkills(['ReactJS', 'NodeJS', 'TS', 'Postgres']);
      expect(skills).toEqual(['React', 'Node.js', 'TypeScript', 'PostgreSQL']);
    });

    it('removes duplicates after normalization', () => {
      const skills = normalizeJobSkills(['ReactJS', 'React', 'react']);
      expect(skills).toEqual(['React']);
    });
  });

  describe('normalizeJob', () => {
    it('returns a fully normalized job payload', () => {
      const rawJob: RawJob = {
        title: 'Sr. ReactJS Developer',
        company: 'Acme Corp',
        jobUrl: 'https://acme.com/jobs/123?ref=linkedin',
        source: 'firecrawl',
        location: 'NYC',
        remoteType: 'REMOTE',
        employmentType: 'FULL_TIME',
        skills: ['ReactJS', 'TS'],
        postedAtConfidence: 'EXACT',
      };

      const normalized = normalizeJob(rawJob);

      expect(normalized.normalizedTitle).toBe('Senior React Developer');
      expect(normalized.normalizedLocation).toBe('New York, NY');
      expect(normalized.remoteType).toBe('REMOTE');
      expect(normalized.employmentType).toBe('FULL_TIME');
      expect(normalized.skills).toEqual(['React', 'TypeScript']);
    });
  });
});
