/**
 * Semantic Match Engine.
 *
 * Computes vector similarity between candidate embedding and job embedding.
 * Supports PostgreSQL native vector cosine distance operator (<=>) when pgvector extension is enabled.
 * Maps cosine similarity [0.0, 1.0] to normalized 0-100 similarity score.
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) {
    return 0;
  }

  const length = Math.min(vecA.length, vecB.length);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < length; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Perform PostgreSQL native vector similarity using `<=>` cosine distance operator when available.
 */
export async function calculatePgVectorSimilarity(
  candidateId: string,
  jobId: string
): Promise<number | null> {
  const enablePgVector = process.env.ENABLE_PGVECTOR !== 'false';

  try {
    const result = await prisma.$queryRawUnsafe<Array<{ similarity: number }>>(`
      SELECT 1 - (e1.vector <=> e2.vector) AS similarity
      FROM "Embedding" e1
      JOIN "Embedding" e2 ON e1."entityType" = 'CANDIDATE' AND e2."entityType" = 'JOB'
      WHERE e1."entityId" = $1 AND e2."entityId" = $2
        AND e1.vector IS NOT NULL AND e2.vector IS NOT NULL
      LIMIT 1
    `, candidateId, jobId);

    if (result && result.length > 0 && typeof result[0].similarity === 'number') {
      return result[0].similarity;
    }

    if (enablePgVector) {
      const msg = `pgvector similarity query returned no valid vector record for candidateId=${candidateId} and jobId=${jobId}`;
      logger.error(`[SemanticMatchService] ${msg}`);
      throw new Error(msg);
    }
  } catch (err) {
    if (enablePgVector) {
      logger.error('[SemanticMatchService] PostgreSQL pgvector similarity query failed', { candidateId, jobId }, err as Error);
      throw err instanceof Error ? err : new Error(String(err));
    } else {
      logger.warn('[SemanticMatchService] pgvector query failed; ENABLE_PGVECTOR=false fallback active');
    }
  }
  return null;
}


export function evaluateSemanticMatch(
  candidateVector: number[],
  jobVector: number[],
  pgVectorSimilarity: number | null = null
): {
  similarity: number;
  semanticScore: number;
} {
  const rawSimilarity = pgVectorSimilarity !== null
    ? pgVectorSimilarity
    : calculateCosineSimilarity(candidateVector, jobVector);

  const similarity = Math.max(0, Math.min(1, rawSimilarity));
  const semanticScore = Math.round(similarity * 100);

  return {
    similarity,
    semanticScore,
  };
}
