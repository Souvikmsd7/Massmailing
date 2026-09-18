import { PrismaClient } from '@prisma/client';
import { calculatePgVectorSimilarity } from './semanticMatchService';
import { getOrGenerateEmbedding } from '../ai/embeddingService';

const prisma = new PrismaClient();

describe('pgvector Integration Test', () => {
  const testCandidateId = 'test-cand-pgv-1';
  const testJobId = 'test-job-pgv-1';
  const originalEnablePgVector = process.env.ENABLE_PGVECTOR;

  beforeAll(() => {
    process.env.ENABLE_PGVECTOR = 'true';
  });

  afterAll(async () => {
    process.env.ENABLE_PGVECTOR = originalEnablePgVector;
    try {
      await prisma.embedding.deleteMany({
        where: {
          entityId: { in: [testCandidateId, testJobId] },
        },
      });
    } catch {
      /* ignore cleanup errors */
    } finally {
      await prisma.$disconnect();
    }
  });

  it('calculates pgvector cosine similarity using native <=> operator in PostgreSQL', async () => {
    // 1. Verify pgvector extension exists explicitly (fails test if extension unavailable)
    const extResult = await prisma.$queryRawUnsafe<Array<{ extname: string }>>(
      `SELECT extname FROM pg_extension WHERE extname = 'vector'`
    );
    const vectorSupported = Boolean(extResult && extResult.length > 0);
    if (!vectorSupported) {
      throw new Error('pgvector extension is not installed in PostgreSQL. pgvector tests cannot pass without pgvector support.');
    }
    expect(vectorSupported).toBe(true);

    // 2. Create candidate & job embedding records with 768-dim unit vector
    const dummyText = 'Software Engineer React TypeScript Node.js PostgreSQL';
    const candVector = await getOrGenerateEmbedding('CANDIDATE', testCandidateId, dummyText);
    const jobVector = await getOrGenerateEmbedding('JOB', testJobId, dummyText);

    expect(candVector).toBeDefined();
    expect(candVector.length).toBe(768);
    expect(jobVector).toBeDefined();
    expect(jobVector.length).toBe(768);

    // 3. Explicitly verify BOTH Candidate and Job vector columns in Embedding table are populated (NOT NULL and valid 768-dim vector)
    const candVectorCheck = await prisma.$queryRawUnsafe<Array<{ count: number; dims: number }>>(
      `SELECT COUNT(*)::int as count, vector_dims("vector")::int as dims FROM "Embedding" WHERE "entityType" = 'CANDIDATE' AND "entityId" = $1 AND "vector" IS NOT NULL GROUP BY "vector"`,
      testCandidateId
    );
    expect(candVectorCheck).toHaveLength(1);
    expect(candVectorCheck[0].count).toBe(1);
    expect(candVectorCheck[0].dims).toBe(768);

    const jobVectorCheck = await prisma.$queryRawUnsafe<Array<{ count: number; dims: number }>>(
      `SELECT COUNT(*)::int as count, vector_dims("vector")::int as dims FROM "Embedding" WHERE "entityType" = 'JOB' AND "entityId" = $1 AND "vector" IS NOT NULL GROUP BY "vector"`,
      testJobId
    );
    expect(jobVectorCheck).toHaveLength(1);
    expect(jobVectorCheck[0].count).toBe(1);
    expect(jobVectorCheck[0].dims).toBe(768);

    // 4. Call calculatePgVectorSimilarity to execute native PostgreSQL <=> query
    const similarity = await calculatePgVectorSimilarity(testCandidateId, testJobId);

    // 5. Verify returned similarity is numeric and identical vectors produce ~1.0
    expect(similarity).not.toBeNull();
    expect(typeof similarity).toBe('number');
    expect(similarity!).toBeCloseTo(1.0, 2);
  });

  it('throws an error when vector columns are unpopulated and does not silently pass', async () => {
    const missingCandId = 'missing-cand-pgv';
    const missingJobId = 'missing-job-pgv';

    await expect(calculatePgVectorSimilarity(missingCandId, missingJobId)).rejects.toThrow(
      /pgvector similarity query returned no valid vector record/
    );
  });
});


