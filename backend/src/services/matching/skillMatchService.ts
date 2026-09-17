/**
 * Skill Match Engine.
 *
 * Deterministically compares normalized candidate skills against job required skills.
 * DOES NOT ask Gemini to determine skill matches.
 * Uses skill normalization infrastructure from skillService.ts.
 */

import { CandidateSkill, Skill } from '@prisma/client';
import { normalizeSkillName } from '../career/skillService';

export interface MatchedSkillItem {
  candidateSkill: string;
  jobSkill: string;
  matchType: 'EXACT' | 'ALIAS';
  confidence: number;
}

export interface SkillMatchResult {
  matchedSkills: MatchedSkillItem[];
  missingSkills: string[];
  partialSkills: Array<{ candidateSkill: string; jobSkill: string }>;
  skillScore: number;
  coverageRatio: number;
}

export type CandidateSkillWithSkill = CandidateSkill & { skill: Skill };

export function evaluateSkillMatch(
  candidateSkills: CandidateSkillWithSkill[],
  jobSkills: string[]
): SkillMatchResult {
  const matchedSkills: MatchedSkillItem[] = [];
  const missingSkills: string[] = [];
  const partialSkills: Array<{ candidateSkill: string; jobSkill: string }> = [];

  // Build candidate normalized skill maps
  const candidateMap = new Map<string, string>(); // normalizedLower -> display name
  for (const cs of candidateSkills) {
    const canonicalName = cs.skill.name;
    const normalizedKey = cs.skill.normalizedName.toLowerCase();
    candidateMap.set(normalizedKey, canonicalName);
  }

  // Deduplicate and normalize job skills
  const cleanJobSkills = [...new Set(jobSkills.map((s) => s.trim()).filter(Boolean))];

  if (cleanJobSkills.length === 0) {
    // If the job specifies no skills, default to neutral/complete score
    return {
      matchedSkills: [],
      missingSkills: [],
      partialSkills: [],
      skillScore: 100,
      coverageRatio: 1.0,
    };
  }

  let matchedCount = 0;

  for (const rawJobSkill of cleanJobSkills) {
    const canonicalJobSkill = normalizeSkillName(rawJobSkill);
    const jobKey = canonicalJobSkill.toLowerCase();

    if (candidateMap.has(jobKey)) {
      matchedCount++;
      const candidateDisplayName = candidateMap.get(jobKey)!;
      const isExactName = rawJobSkill.trim() === candidateDisplayName;

      matchedSkills.push({
        candidateSkill: candidateDisplayName,
        jobSkill: rawJobSkill,
        matchType: isExactName ? 'EXACT' : 'ALIAS',
        confidence: 1.0,
      });
    } else {
      missingSkills.push(rawJobSkill);
    }
  }

  const coverageRatio = matchedCount / cleanJobSkills.length;
  const skillScore = Math.round(coverageRatio * 100);

  return {
    matchedSkills,
    missingSkills,
    partialSkills,
    skillScore,
    coverageRatio,
  };
}
