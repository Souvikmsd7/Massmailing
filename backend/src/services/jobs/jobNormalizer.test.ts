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
  // ─── normalizeJobTitle ────────────────────────────────────────────────────────

  describe('normalizeJobTitle', () => {
    it('normalizes Sr. Software Engineer → Senior Software Engineer', () => {
      expect(normalizeJobTitle('Sr. Software Engineer')).toBe('Senior Software Engineer');
    });

    it('normalizes Jr. Developer → Junior Developer', () => {
      expect(normalizeJobTitle('Jr. Developer')).toBe('Junior Developer');
    });

    it('normalizes React JS Developer → React Developer', () => {
      expect(normalizeJobTitle('React JS Developer')).toBe('React Developer');
    });

    it('normalizes ReactJS Developer → React Developer', () => {
      expect(normalizeJobTitle('ReactJS Developer')).toBe('React Developer');
    });

    it('normalizes Node JS Engineer → Node.js Engineer', () => {
      expect(normalizeJobTitle('Node JS Engineer')).toBe('Node.js Engineer');
    });

    it('normalizes NodeJS Engineer → Node.js Engineer', () => {
      expect(normalizeJobTitle('NodeJS Engineer')).toBe('Node.js Engineer');
    });

    it('normalizes Next JS Developer → Next.js Developer', () => {
      expect(normalizeJobTitle('Next JS Developer')).toBe('Next.js Developer');
    });

    it('normalizes NextJS Developer → Next.js Developer', () => {
      expect(normalizeJobTitle('NextJS Developer')).toBe('Next.js Developer');
    });

    it('normalizes Fullstack Developer → Full Stack Developer', () => {
      expect(normalizeJobTitle('Fullstack Developer')).toBe('Full Stack Developer');
    });

    it('normalizes Full-Stack Developer → Full Stack Developer', () => {
      expect(normalizeJobTitle('Full-Stack Developer')).toBe('Full Stack Developer');
    });

    it('normalizes Frontend Engineer (with Front-End variant)', () => {
      expect(normalizeJobTitle('Front-End Engineer')).toBe('Frontend Engineer');
    });

    it('normalizes Backend Engineer (with Back-End variant)', () => {
      expect(normalizeJobTitle('Back-End Engineer')).toBe('Backend Engineer');
    });

    it('trims extra whitespace', () => {
      expect(normalizeJobTitle('  Frontend   Engineer  ')).toBe('Frontend Engineer');
    });

    it('collapses multiple internal spaces', () => {
      expect(normalizeJobTitle('Senior  React  Developer')).toBe('Senior React Developer');
    });

    it('does not change unrelated title', () => {
      expect(normalizeJobTitle('Data Scientist')).toBe('Data Scientist');
    });
  });

  // ─── normalizeLocation ────────────────────────────────────────────────────────

  describe('normalizeLocation', () => {
    it('expands NYC → New York, NY', () => {
      expect(normalizeLocation('NYC')).toBe('New York, NY');
    });

    it('expands SF → San Francisco, CA', () => {
      expect(normalizeLocation('SF')).toBe('San Francisco, CA');
    });

    it('expands LA → Los Angeles, CA', () => {
      expect(normalizeLocation('LA')).toBe('Los Angeles, CA');
    });

    it('expands US → United States', () => {
      expect(normalizeLocation('US')).toBe('United States');
    });

    it('expands UK → United Kingdom', () => {
      expect(normalizeLocation('UK')).toBe('United Kingdom');
    });

    it('returns null for empty string', () => {
      expect(normalizeLocation('')).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(normalizeLocation(undefined)).toBeNull();
    });

    it('returns null for null', () => {
      expect(normalizeLocation(null)).toBeNull();
    });

    it('returns null for whitespace-only string', () => {
      expect(normalizeLocation('   ')).toBeNull();
    });

    it('preserves full location names unchanged', () => {
      expect(normalizeLocation('Austin, TX')).toBe('Austin, TX');
    });

    it('trims leading/trailing whitespace', () => {
      expect(normalizeLocation('  Remote  ')).toBe('Remote');
    });
  });

  // ─── normalizeRemoteType ──────────────────────────────────────────────────────

  describe('normalizeRemoteType', () => {
    it('detects REMOTE from "Remote"', () => {
      expect(normalizeRemoteType('Remote')).toBe('REMOTE');
    });

    it('detects REMOTE from "Work from home"', () => {
      expect(normalizeRemoteType('Work from home')).toBe('REMOTE');
    });

    it('detects REMOTE from "Fully remote"', () => {
      expect(normalizeRemoteType('Fully remote')).toBe('REMOTE');
    });

    it('detects REMOTE from "Remote only"', () => {
      expect(normalizeRemoteType('Remote only')).toBe('REMOTE');
    });

    it('detects REMOTE from raw REMOTE enum value', () => {
      expect(normalizeRemoteType('REMOTE')).toBe('REMOTE');
    });

    it('detects HYBRID from "Hybrid"', () => {
      expect(normalizeRemoteType('Hybrid')).toBe('HYBRID');
    });

    it('detects HYBRID from "partially remote"', () => {
      expect(normalizeRemoteType('Partially remote')).toBe('HYBRID');
    });

    it('detects ONSITE from "Onsite"', () => {
      expect(normalizeRemoteType('Onsite')).toBe('ONSITE');
    });

    it('detects ONSITE from "In-office"', () => {
      expect(normalizeRemoteType('In-office')).toBe('ONSITE');
    });

    it('detects ONSITE from "In person"', () => {
      expect(normalizeRemoteType('In person')).toBe('ONSITE');
    });

    it('returns UNKNOWN when undefined', () => {
      expect(normalizeRemoteType(undefined)).toBe('UNKNOWN');
    });

    it('returns UNKNOWN for ambiguous text', () => {
      expect(normalizeRemoteType('Full Time')).toBe('UNKNOWN');
    });

    it('uses location as fallback when primary value is null', () => {
      expect(normalizeRemoteType(null, 'Remote, Worldwide')).toBe('REMOTE');
    });
  });

  // ─── normalizeEmploymentType ──────────────────────────────────────────────────

  describe('normalizeEmploymentType', () => {
    it('detects FULL_TIME from "Full Time"', () => {
      expect(normalizeEmploymentType('Full Time')).toBe('FULL_TIME');
    });

    it('detects FULL_TIME from "full-time"', () => {
      expect(normalizeEmploymentType('full-time')).toBe('FULL_TIME');
    });

    it('detects FULL_TIME from "permanent"', () => {
      expect(normalizeEmploymentType('permanent')).toBe('FULL_TIME');
    });

    it('detects PART_TIME from "Part-Time"', () => {
      expect(normalizeEmploymentType('Part-Time')).toBe('PART_TIME');
    });

    it('detects CONTRACT from "Contractor"', () => {
      expect(normalizeEmploymentType('Contractor')).toBe('CONTRACT');
    });

    it('detects CONTRACT from "Freelance"', () => {
      expect(normalizeEmploymentType('Freelance')).toBe('CONTRACT');
    });

    it('detects CONTRACT from "C2C"', () => {
      expect(normalizeEmploymentType('C2C')).toBe('CONTRACT');
    });

    it('detects INTERNSHIP from "Summer Intern"', () => {
      expect(normalizeEmploymentType('Summer Intern')).toBe('INTERNSHIP');
    });

    it('detects INTERNSHIP from "Internship"', () => {
      expect(normalizeEmploymentType('Internship')).toBe('INTERNSHIP');
    });

    it('detects TEMPORARY from "Temporary"', () => {
      expect(normalizeEmploymentType('Temporary')).toBe('TEMPORARY');
    });

    it('detects TEMPORARY from "Seasonal"', () => {
      expect(normalizeEmploymentType('Seasonal')).toBe('TEMPORARY');
    });

    it('returns UNKNOWN when undefined', () => {
      expect(normalizeEmploymentType(undefined)).toBe('UNKNOWN');
    });

    it('returns UNKNOWN when empty', () => {
      expect(normalizeEmploymentType('')).toBe('UNKNOWN');
    });
  });

  // ─── normalizeJobSkills ───────────────────────────────────────────────────────

  describe('normalizeJobSkills', () => {
    it('normalizes ReactJS → React', () => {
      const skills = normalizeJobSkills(['ReactJS']);
      expect(skills).toContain('React');
    });

    it('normalizes NodeJS → Node.js', () => {
      const skills = normalizeJobSkills(['NodeJS']);
      expect(skills).toContain('Node.js');
    });

    it('normalizes TS → TypeScript', () => {
      const skills = normalizeJobSkills(['TS']);
      expect(skills).toContain('TypeScript');
    });

    it('normalizes Postgres → PostgreSQL', () => {
      const skills = normalizeJobSkills(['Postgres']);
      expect(skills).toContain('PostgreSQL');
    });

    it('removes duplicate skills after normalization', () => {
      const skills = normalizeJobSkills(['ReactJS', 'React', 'react', 'React.js']);
      // All should normalize to one React entry
      const reactCount = skills.filter((s) => s.toLowerCase() === 'react').length;
      expect(reactCount).toBe(1);
    });

    it('removes exact duplicate skill strings', () => {
      const skills = normalizeJobSkills(['JavaScript', 'JavaScript', 'TypeScript']);
      const jsCount = skills.filter((s) => s === 'JavaScript').length;
      expect(jsCount).toBe(1);
    });

    it('returns empty array for empty input', () => {
      expect(normalizeJobSkills([])).toEqual([]);
    });

    it('filters out blank skill strings', () => {
      const skills = normalizeJobSkills(['', '  ', 'React']);
      expect(skills).toContain('React');
      expect(skills).not.toContain('');
    });

    it('normalizes mixed list correctly', () => {
      const skills = normalizeJobSkills(['ReactJS', 'NodeJS', 'TS', 'Postgres']);
      expect(skills).toEqual(['React', 'Node.js', 'TypeScript', 'PostgreSQL']);
    });
  });

  // ─── normalizeJob ─────────────────────────────────────────────────────────────

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

    it('handles null optional fields gracefully', () => {
      const rawJob: RawJob = {
        title: 'Engineer',
        company: 'Corp',
        jobUrl: 'https://corp.com/jobs/1',
        source: 'manual',
        remoteType: 'UNKNOWN',
        employmentType: 'UNKNOWN',
        postedAtConfidence: 'UNKNOWN',
        skills: [],
      };

      const normalized = normalizeJob(rawJob);
      expect(normalized.description).toBeNull();
      expect(normalized.location).toBeNull();
      expect(normalized.normalizedLocation).toBeNull();
      expect(normalized.sourceJobId).toBeNull();
      expect(normalized.postedAt).toBeNull();
      expect(normalized.postedAtConfidence).toBe('UNKNOWN');
    });

    it('converts postedAt string to Date object', () => {
      const isoDate = '2024-01-15T12:00:00.000Z';
      const rawJob: RawJob = {
        title: 'Engineer',
        company: 'Corp',
        jobUrl: 'https://corp.com/jobs/1',
        source: 'manual',
        remoteType: 'UNKNOWN',
        employmentType: 'UNKNOWN',
        postedAt: isoDate,
        postedAtConfidence: 'EXACT',
        skills: [],
      };

      const normalized = normalizeJob(rawJob);
      expect(normalized.postedAt).toBeInstanceOf(Date);
      expect(normalized.postedAt!.toISOString()).toBe(isoDate);
    });
  });
});
