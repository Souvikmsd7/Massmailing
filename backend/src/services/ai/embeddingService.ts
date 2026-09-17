/**
 * Embedding Service.
 *
 * Responsibilities:
 * - Generate text embeddings via Google Gemini text-embedding-004 REST API
 * - Cache embeddings in the Embedding database table
 * - Prevent unnecessary regenerate operations using content hashing (SHA-256)
 * - Provide fallback mock vectors for offline/test environments when GEMINI_API_KEY is unset
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004';
const EMBEDDING_DIMENSION = 768;

function computeHash(text: string): string {
  return crypto.createHash('sha256').update(text.trim()).digest('hex');
}

/**
 * Generate a deterministic pseudo-vector when Gemini API key is unavailable (for testing/dev).
 */
function generateFallbackVector(text: string): number[] {
  const hash = computeHash(text);
  const vector: number[] = new Array(EMBEDDING_DIMENSION).fill(0);
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    const charCode = hash.charCodeAt(i % hash.length);
    vector[i] = (charCode % 100) / 100 - 0.5;
  }
  // Normalize vector to unit length
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return norm > 0 ? vector.map((v) => v / norm) : vector;
}

/**
 * Call Gemini text-embedding-004 API to generate an embedding for text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const trimmed = text.trim();
  if (!trimmed) {
    return new Array(EMBEDDING_DIMENSION).fill(0);
  }

  if (!GEMINI_API_KEY) {
    logger.warn('[EmbeddingService] GEMINI_API_KEY not set; using fallback vector');
    return generateFallbackVector(trimmed);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`;
  const body = {
    model: `models/${EMBEDDING_MODEL}`,
    content: {
      parts: [{ text: trimmed }],
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      logger.error(`[EmbeddingService] API request failed: ${response.status} ${errText.slice(0, 150)}`);
      return generateFallbackVector(trimmed);
    }

    const data = (await response.json()) as any;
    const values: number[] | undefined = data?.embedding?.values;

    if (!values || !Array.isArray(values) || values.length === 0) {
      logger.warn('[EmbeddingService] Received empty embedding values from Gemini');
      return generateFallbackVector(trimmed);
    }

    return values;
  } catch (err) {
    logger.error('[EmbeddingService] Failed to generate embedding via Gemini REST API', {}, err as Error);
    return generateFallbackVector(trimmed);
  }
}

/**
 * Retrieve or generate & cache an embedding for an entity (CANDIDATE or JOB).
 */
export async function getOrGenerateEmbedding(
  entityType: 'CANDIDATE' | 'JOB',
  entityId: string,
  text: string
): Promise<number[]> {
  const contentHash = computeHash(text);

  const existing = await prisma.embedding.findUnique({
    where: {
      entityType_entityId: {
        entityType,
        entityId,
      },
    },
  });

  if (existing && existing.contentHash === contentHash && existing.embedding.length > 0) {
    return existing.embedding;
  }

  const embeddingValues = await generateEmbedding(text);

  await prisma.embedding.upsert({
    where: {
      entityType_entityId: {
        entityType,
        entityId,
      },
    },
    update: {
      embedding: embeddingValues,
      model: EMBEDDING_MODEL,
      contentHash,
      updatedAt: new Date(),
    },
    create: {
      entityType,
      entityId,
      embedding: embeddingValues,
      model: EMBEDDING_MODEL,
      contentHash,
    },
  });

  return embeddingValues;
}
