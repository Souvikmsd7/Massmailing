import { evaluateHardFilters } from './hardFilterService';
import { CandidateProfile, Job } from '@prisma/client';

describe('HardFilterService', () => {
  const baseCandidate: Partial<CandidateProfile> = {
    id: 'cand-1',
    userId: 'user-1',
    location: 'New York, NY',
    preferredLocations: ['New York', 'Remote'],
    remotePreference: 'remote',
    workAuthorization: 'US Citizen',
    yearsOfExperience: 5,
    salaryMin: 120000,
  };

  const baseJob: Partial<Job> = {
    id: 'job-1',
    title: 'Senior Developer',
    company: 'TechCorp',
    location: 'New York, NY',
    normalizedLocation: 'new york, ny',
    remoteType: 'REMOTE',
    employmentType: 'FULL_TIME',
    salaryMin: 130000,
    salaryMax: 160000,
    skills: ['React', 'TypeScript'],
  };

  it('evaluates eligible matching candidate and job', () => {
    const result = evaluateHardFilters(baseCandidate as CandidateProfile, baseJob as Job);
    expect(result.eligible).toBe(true);
    expect(result.failedFilters).toHaveLength(0);
    expect(result.hardFilterScore).toBe(100);
  });

  it('detects remote preference mismatch', () => {
    const candidateOnsite = { ...baseCandidate, remotePreference: 'remote' };
    const jobOnsite = { ...baseJob, remoteType: 'ONSITE' as const, normalizedLocation: 'San Francisco, CA' };
    const result = evaluateHardFilters(candidateOnsite as CandidateProfile, jobOnsite as Job);
    expect(result.eligible).toBe(false);
    expect(result.failedFilters).toContain('remoteType');
  });

  it('detects salary mismatch when job max is below candidate min', () => {
    const highSalaryCandidate = { ...baseCandidate, salaryMin: 200000 };
    const result = evaluateHardFilters(highSalaryCandidate as CandidateProfile, baseJob as Job);
    expect(result.eligible).toBe(false);
    expect(result.failedFilters).toContain('salary');
  });

  it('handles missing candidate preferences with null indicator without failing eligibility', () => {
    const emptyCandidate: Partial<CandidateProfile> = {
      id: 'cand-2',
      userId: 'user-2',
      preferredLocations: [],
      remotePreference: null,
      workAuthorization: null,
      yearsOfExperience: null,
      salaryMin: null,
    };
    const result = evaluateHardFilters(emptyCandidate as CandidateProfile, baseJob as Job);
    expect(result.eligible).toBe(true);
    expect(result.locationMatch).toBeNull();
    expect(result.remoteMatch).toBeNull();
    expect(result.salaryMatch).toBeNull();
    expect(result.failedFilters).toHaveLength(0);
  });
});
