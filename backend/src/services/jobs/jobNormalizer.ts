/**
 * Job Normalization Layer.
 *
 * Normalizes raw job fields to canonical, consistent representations.
 * Reuses Phase 1 skill normalization — no duplication.
 */

import { normalizeSkillName } from '../career/skillService';
import { RawJob } from './jobSourceAdapter';

// ─── Title Normalization ───────────────────────────────────────────────────────

/**
 * Common title alias mappings for deduplication purposes.
 * e.g. "React JS Developer" → "React Developer"
 */
const TITLE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bReact\.?\s*JS\b/gi, 'React'],
  [/\bNode\.?\s*JS\b/gi, 'Node.js'],
  [/\bNext\.?\s*JS\b/gi, 'Next.js'],
  [/\bVue\.?\s*JS\b/gi, 'Vue.js'],
  [/\bAngular\.?\s*JS\b/gi, 'Angular'],
  [/\bTypeScript\b/gi, 'TypeScript'],
  [/\bJavaScript\b/gi, 'JavaScript'],
  [/\bFull[\s-]?Stack\b/gi, 'Full Stack'],
  [/\bFront[\s-]?End\b/gi, 'Frontend'],
  [/\bBack[\s-]?End\b/gi, 'Backend'],
  [/\bDevOps\b/gi, 'DevOps'],
  [/\bML\b/g, 'Machine Learning'],
  [/\bSr\.\s*/gi, 'Senior '],
  [/\bJr\.\s*/gi, 'Junior '],
  [/\bEng\.\s*/gi, 'Engineer '],
];

export function normalizeJobTitle(title: string): string {
  let normalized = title.trim();
  for (const [pattern, replacement] of TITLE_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }
  // Collapse multiple spaces
  normalized = normalized.replace(/\s{2,}/g, ' ').trim();
  return normalized;
}

// ─── Location Normalization ────────────────────────────────────────────────────

export function normalizeLocation(location: string | null | undefined): string | null {
  if (!location) return null;
  const trimmed = location.trim();
  if (!trimmed) return null;

  // Expand common abbreviations
  return trimmed
    .replace(/\bUS\b/gi, 'United States')
    .replace(/\bUK\b/gi, 'United Kingdom')
    .replace(/\bNYC\b/gi, 'New York, NY')
    .replace(/\bSF\b/gi, 'San Francisco, CA')
    .replace(/\bLA\b/gi, 'Los Angeles, CA')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ─── Remote Type Normalization ─────────────────────────────────────────────────

const REMOTE_PATTERNS: Array<[RegExp, 'REMOTE' | 'HYBRID' | 'ONSITE']> = [
  // Hybrid/partial must come before general remote to avoid misclassification
  [/\bhybrid\b|\bpartially[\s-]?remote\b|\bflexible[\s-]?location\b/i, 'HYBRID'],
  // Fully remote (strong signals)
  [/\bfully[\s-]?remote\b|\bwork[\s-]?from[\s-]?home\b|\bremote[\s-]?only\b/i, 'REMOTE'],
  // General remote
  [/\bremote\b/i, 'REMOTE'],
  // Onsite
  [/\bin[\s-]?office\b|\bon[\s-]?site\b|\bonsite\b|\bin[\s-]?person\b/i, 'ONSITE'],
];

export function normalizeRemoteType(
  raw: string | null | undefined,
  location?: string | null
): 'REMOTE' | 'HYBRID' | 'ONSITE' | 'UNKNOWN' {
  const text = [raw, location].filter(Boolean).join(' ');
  if (!text.trim()) return 'UNKNOWN';

  for (const [pattern, type] of REMOTE_PATTERNS) {
    if (pattern.test(text)) return type;
  }
  return 'UNKNOWN';
}

// ─── Employment Type Normalization ─────────────────────────────────────────────

const EMPLOYMENT_PATTERNS: Array<[RegExp, 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'TEMPORARY']> = [
  [/\bfull[\s\-_]?time\b|\bpermanent\b/i, 'FULL_TIME'],
  [/\bpart[\s\-_]?time\b/i, 'PART_TIME'],
  [/\bcontract(?:or|ed)?\b|\bfreelance\b|\bc2c\b|\bcorp[\s-]?to[\s-]?corp\b/i, 'CONTRACT'],
  [/\bintern(?:ship)?\b/i, 'INTERNSHIP'],
  [/\btemporary\b|\btemp\b|\bseasonal\b/i, 'TEMPORARY'],
];

export function normalizeEmploymentType(
  raw: string | null | undefined
): 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'TEMPORARY' | 'UNKNOWN' {
  if (!raw) return 'UNKNOWN';

  for (const [pattern, type] of EMPLOYMENT_PATTERNS) {
    if (pattern.test(raw)) return type;
  }
  return 'UNKNOWN';
}

// ─── Skill Normalization ───────────────────────────────────────────────────────

/**
 * Normalize a list of raw skill strings using Phase 1's normalizeSkillName.
 * Deduplicates after normalization.
 */
export function normalizeJobSkills(skills: string[]): string[] {
  const normalized = skills
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeSkillName);

  // Deduplicate (case-insensitive)
  const seen = new Set<string>();
  return normalized.filter((s) => {
    const lower = s.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

// ─── Full Job Normalization ────────────────────────────────────────────────────

export interface NormalizedJob {
  title: string;
  normalizedTitle: string;
  description: string | null;
  company: string;
  companyUrl: string | null;
  jobUrl: string;
  source: string;
  sourceJobId: string | null;
  location: string | null;
  normalizedLocation: string | null;
  remoteType: 'REMOTE' | 'HYBRID' | 'ONSITE' | 'UNKNOWN';
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'TEMPORARY' | 'UNKNOWN';
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  postedAt: Date | null;
  postedAtConfidence: 'EXACT' | 'APPROXIMATE' | 'UNKNOWN';
  skills: string[];
}

export function normalizeJob(raw: RawJob): NormalizedJob {
  const normalizedTitle = normalizeJobTitle(raw.title);
  const normalizedLocation = normalizeLocation(raw.location);
  const remoteType = normalizeRemoteType(
    raw.remoteType === 'UNKNOWN' ? null : raw.remoteType,
    raw.location
  );
  const employmentType = normalizeEmploymentType(
    raw.employmentType === 'UNKNOWN' ? null : raw.employmentType
  );
  const skills = normalizeJobSkills(raw.skills ?? []);

  const postedAt = raw.postedAt ? new Date(raw.postedAt) : null;
  const confidence = raw.postedAtConfidence ?? 'UNKNOWN';

  return {
    title: raw.title.trim(),
    normalizedTitle,
    description: raw.description ?? null,
    company: raw.company.trim(),
    companyUrl: raw.companyUrl ?? null,
    jobUrl: raw.jobUrl.trim(),
    source: raw.source,
    sourceJobId: raw.sourceJobId ?? null,
    location: raw.location ?? null,
    normalizedLocation,
    remoteType,
    employmentType,
    salaryMin: raw.salaryMin ?? null,
    salaryMax: raw.salaryMax ?? null,
    salaryCurrency: raw.salaryCurrency ?? null,
    postedAt,
    postedAtConfidence: confidence,
    skills,
  };
}
