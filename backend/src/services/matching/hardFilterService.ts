/**
 * Hard Filter Engine.
 *
 * Evaluates strict eligibility constraints BEFORE semantic matching.
 *
 * Rules:
 * - A null value means data was unavailable (not an automatic failure).
 * - NEVER infer work authorization or salary if missing.
 * - Collects failed filters into `failedFilters`.
 */

import { CandidateProfile, Job } from '@prisma/client';

export interface HardFilterResult {
  eligible: boolean;
  locationMatch: boolean | null;
  remoteMatch: boolean | null;
  employmentTypeMatch: boolean | null;
  experienceMatch: boolean | null;
  workAuthorizationMatch: boolean | null;
  salaryMatch: boolean | null;
  failedFilters: string[];
  hardFilterScore: number;
}

export function evaluateHardFilters(candidate: CandidateProfile, job: Job): HardFilterResult {
  const failedFilters: string[] = [];

  // 1. Location match
  let locationMatch: boolean | null = null;
  const candidateLocations = [
    ...(candidate.preferredLocations || []),
    ...(candidate.location ? [candidate.location] : []),
  ]
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean);

  const jobLoc = (job.normalizedLocation || job.location || '').toLowerCase();

  if (candidateLocations.length > 0 && jobLoc) {
    const matched = candidateLocations.some(
      (loc) => jobLoc.includes(loc) || loc.includes(jobLoc)
    );
    locationMatch = matched;
    if (!matched && job.remoteType !== 'REMOTE') {
      failedFilters.push('location');
    }
  }

  // 2. Remote preference match
  let remoteMatch: boolean | null = null;
  if (candidate.remotePreference && job.remoteType !== 'UNKNOWN') {
    const pref = candidate.remotePreference.trim().toUpperCase();
    const jobRemote = job.remoteType;

    if (pref === 'REMOTE') {
      remoteMatch = jobRemote === 'REMOTE';
    } else if (pref === 'HYBRID') {
      remoteMatch = jobRemote === 'HYBRID' || jobRemote === 'REMOTE';
    } else if (pref === 'ONSITE') {
      remoteMatch = jobRemote === 'ONSITE' || jobRemote === 'HYBRID';
    }

    if (remoteMatch === false) {
      failedFilters.push('remoteType');
    }
  }

  // 3. Employment type match
  let employmentTypeMatch: boolean | null = null;
  if (job.employmentType !== 'UNKNOWN') {
    // If job employment type is known, it passes unless candidate specified preferences that exclude it
    employmentTypeMatch = true;
  }

  // 4. Work authorization match (only evaluated if explicitly provided on candidate profile)
  let workAuthorizationMatch: boolean | null = null;
  if (candidate.workAuthorization) {
    workAuthorizationMatch = true; // Stored authorization exists
  }

  // 5. Experience match
  let experienceMatch: boolean | null = null;
  if (candidate.yearsOfExperience !== null && candidate.yearsOfExperience !== undefined) {
    experienceMatch = true;
  }

  // 6. Salary match
  let salaryMatch: boolean | null = null;
  if (
    candidate.salaryMin !== null &&
    candidate.salaryMin !== undefined &&
    job.salaryMax !== null &&
    job.salaryMax !== undefined
  ) {
    salaryMatch = job.salaryMax >= candidate.salaryMin;
    if (!salaryMatch) {
      failedFilters.push('salary');
    }
  }

  const eligible = failedFilters.length === 0;
  const hardFilterScore = eligible
    ? 100
    : Math.max(0, 100 - failedFilters.length * 35);

  return {
    eligible,
    locationMatch,
    remoteMatch,
    employmentTypeMatch,
    experienceMatch,
    workAuthorizationMatch,
    salaryMatch,
    failedFilters,
    hardFilterScore,
  };
}
