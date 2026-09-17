/**
 * Skill Match Engine.
 *
 * Deterministically compares candidate skills against job required skills.
 * Queries and consumes the Phase 1 SkillAlias database table alongside normalizeSkillName().
 * DOES NOT ask Gemini to determine skill matches.
 */

import { CandidateSkill, Skill, PrismaClient } from '@prisma/client';
import { normalizeSkillName } from '../career/skillService';

const prisma = new PrismaClient();

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

export async function evaluateSkillMatch(
  candidateSkills: CandidateSkillWithSkill[],
  jobSkills: string[]
): Promise<SkillMatchResult> {
  const matchedSkills: MatchedSkillItem[] = [];
  const missingSkills: string[] = [];
  const partialSkills: Array<{ candidateSkill: string; jobSkill: string }> = [];

  // Build candidate normalized skill maps and ID set
  const candidateMap = new Map<string, string>(); // normalizedLower -> display name
  const candidateSkillIds = new Set<string>();

  for (const cs of candidateSkills) {
    const canonicalName = cs.skill.name;
    const normalizedKey = cs.skill.normalizedName.toLowerCase();
    candidateMap.set(normalizedKey, canonicalName);
    candidateSkillIds.add(cs.skill.id);
  }

  // Load database SkillAlias table entries associated with candidate skills
  const dbAliases = candidateSkillIds.size > 0
    ? await prisma.skillAlias.findMany({
        where: {
          skillId: { in: Array.from(candidateSkillIds) },
        },
        include: { skill: true },
      })
    : [];


  const aliasMap = new Map<string, string>(); // aliasLower -> canonical skill name
  for (const aliasRecord of dbAliases) {
    aliasMap.set(aliasRecord.alias.trim().toLowerCase(), aliasRecord.skill.name);
  }

  // Deduplicate and normalize job skills
  const cleanJobSkills = [...new Set(jobSkills.map((s) => s.trim()).filter(Boolean))];

  if (cleanJobSkills.length === 0) {
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
    const rawLower = rawJobSkill.trim().toLowerCase();
    const canonicalJobSkill = normalizeSkillName(rawJobSkill);
    const jobKey = canonicalJobSkill.toLowerCase();

    // Check 1: Direct normalized candidate skill match
    if (candidateMap.has(jobKey)) {
      matchedCount++;
      const candidateDisplayName = candidateMap.get(jobKey)!;
      const isExactName = rawJobSkill.trim().toLowerCase() === candidateDisplayName.toLowerCase();

      matchedSkills.push({
        candidateSkill: candidateDisplayName,
        jobSkill: rawJobSkill,
        matchType: isExactName ? 'EXACT' : 'ALIAS',
        confidence: 1.0,
      });
    }
    // Check 2: Database SkillAlias table match
    else if (aliasMap.has(rawLower)) {
      matchedCount++;
      const candidateDisplayName = aliasMap.get(rawLower)!;
      matchedSkills.push({
        candidateSkill: candidateDisplayName,
        jobSkill: rawJobSkill,
        matchType: 'ALIAS',
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
