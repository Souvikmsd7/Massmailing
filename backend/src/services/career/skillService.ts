import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

// Type alias for a Prisma transaction client
type PrismaTx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

// ─── Normalization dictionary ─────────────────────────────────────────────────

/**
 * Seed aliases for deterministic normalization.
 * Key: lowercase alias → Value: canonical display name
 *
 * Keep this maintainable — add as needed, do not over-engineer.
 */
const ALIAS_MAP: Record<string, string> = {
  // React
  'react': 'React',
  'reactjs': 'React',
  'react.js': 'React',
  'react js': 'React',
  // Next.js
  'next': 'Next.js',
  'nextjs': 'Next.js',
  'next.js': 'Next.js',
  'next js': 'Next.js',
  // Node.js
  'node': 'Node.js',
  'nodejs': 'Node.js',
  'node.js': 'Node.js',
  'node js': 'Node.js',
  // TypeScript / JavaScript
  'ts': 'TypeScript',
  'typescript': 'TypeScript',
  'js': 'JavaScript',
  'javascript': 'JavaScript',
  'es6': 'JavaScript',
  // Python
  'python': 'Python',
  'python3': 'Python',
  // PostgreSQL
  'postgres': 'PostgreSQL',
  'postgresql': 'PostgreSQL',
  'pg': 'PostgreSQL',
  // MongoDB
  'mongo': 'MongoDB',
  'mongodb': 'MongoDB',
  // Redis
  'redis': 'Redis',
  // Docker / Kubernetes
  'docker': 'Docker',
  'k8s': 'Kubernetes',
  'kubernetes': 'Kubernetes',
  // Vue
  'vue': 'Vue.js',
  'vuejs': 'Vue.js',
  'vue.js': 'Vue.js',
  // Angular
  'angular': 'Angular',
  'angularjs': 'AngularJS',
  // GraphQL
  'graphql': 'GraphQL',
  'gql': 'GraphQL',
  // REST
  'rest api': 'REST API',
  'restapi': 'REST API',
  'restful': 'REST API',
  // AWS
  'aws': 'AWS',
  'amazon web services': 'AWS',
  // GCP
  'gcp': 'GCP',
  'google cloud': 'GCP',
  // Azure
  'azure': 'Azure',
  'microsoft azure': 'Azure',
};

/**
 * Normalize a raw skill name to its canonical form.
 * Steps: trim → lowercase → alias lookup → title-case fallback
 */
export function normalizeSkillName(raw: string): string {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  if (ALIAS_MAP[lower]) {
    return ALIAS_MAP[lower];
  }

  // Title-case words: "machine learning" → "Machine Learning"
  return trimmed
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Find or create a canonical Skill record by normalized name.
 */
export async function findOrCreateSkill(rawName: string) {
  const canonical = normalizeSkillName(rawName);
  const normalizedName = canonical.toLowerCase();

  let skill = await prisma.skill.findUnique({
    where: { normalizedName },
  });

  if (!skill) {
    skill = await prisma.skill.create({
      data: {
        name: canonical,
        normalizedName,
      },
    });

    // Seed the alias for the original raw name if different
    const aliasRaw = rawName.trim().toLowerCase();
    if (aliasRaw !== normalizedName) {
      await prisma.skillAlias.upsert({
        where: { alias: rawName.trim() },
        update: {},
        create: { skillId: skill.id, alias: rawName.trim() },
      }).catch(() => {
        /* ignore duplicate alias races */
      });
    }
  }

  return skill;
}

/**
 * Upsert CandidateSkill records for a batch of skill names.
 * Avoids duplicate skills for the same candidate.
 *
 * @param tx - Optional Prisma transaction client. When provided, errors propagate
 *             so the enclosing transaction rolls back atomically.
 *             When omitted, failures are logged and skipped (non-fatal standalone use).
 */
export async function upsertCandidateSkills(
  candidateId: string,
  skillNames: string[],
  source: 'RESUME' | 'MANUAL' | 'AI' = 'RESUME',
  tx?: PrismaTx
) {
  const db = tx ?? prisma;
  const unique = [...new Set(skillNames.map((s) => s.trim()).filter(Boolean))];

  for (const name of unique) {
    if (tx) {
      // Inside a transaction — errors must propagate to trigger rollback
      const skill = await findOrCreateSkill(name);
      await db.candidateSkill.upsert({
        where: {
          candidateId_skillId: { candidateId, skillId: skill.id },
        },
        update: { source, updatedAt: new Date() },
        create: {
          candidateId,
          skillId: skill.id,
          source,
        },
      });
    } else {
      // Standalone call — swallow individual failures to avoid breaking manual skill add
      try {
        const skill = await findOrCreateSkill(name);
        await prisma.candidateSkill.upsert({
          where: {
            candidateId_skillId: { candidateId, skillId: skill.id },
          },
          update: { source, updatedAt: new Date() },
          create: {
            candidateId,
            skillId: skill.id,
            source,
          },
        });
      } catch (err) {
        logger.warn(`[SkillService] Failed to upsert skill "${name}"`, { err });
      }
    }
  }
}

/**
 * Remove a skill from a candidate's profile.
 */
export async function removeCandidateSkill(candidateId: string, skillId: string) {
  await prisma.candidateSkill.delete({
    where: { candidateId_skillId: { candidateId, skillId } },
  });
}

/**
 * List all skills for a candidate.
 */
export async function listCandidateSkills(candidateId: string) {
  return prisma.candidateSkill.findMany({
    where: { candidateId },
    include: { skill: true },
    orderBy: { createdAt: 'asc' },
  });
}
