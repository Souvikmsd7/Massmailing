import { PrismaClient } from '@prisma/client';
import { calculatePgVectorSimilarity } from './semanticMatchService';

const prisma = new PrismaClient();

describe('pgvector Integration Test', () => {
  const testCandidateId = 'test-cand-pgv-1';
  const testJobId = 'test-job-pgv-1';

  afterAll(async () => {
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
    let vectorSupported = false;
    try {
      const extResult = await prisma.$queryRawUnsafe<Array<{ extname: string }>>(
        `SELECT extname FROM pg_extension WHERE extname = 'vector'`
      );
      vectorSupported = extResult && extResult.length > 0;
    } catch {
      vectorSupported = false;
    }

    if (!vectorSupported) {
      console.warn('[pgvectorIntegration.test] PostgreSQL vector extension not active in test environment');
      return;
    }

    // 1 & 2: Create candidate & job embedding records with 768 dimensions
    const dummyVector = new Array(768).fill(0.1);
    const formattedVec = `[${dummyVector.join(',')}]`;

    // Upsert candidate embedding
    const candEmb = await prisma.embedding.upsert({
      where: {
        entityType_entityId: { entityType: 'CANDIDATE', entityId: testCandidateId },
      },
      update: { embedding: dummyVector, model: 'text-embedding-004' },
      create: { entityType: 'CANDIDATE', entityId: testCandidateId, embedding: dummyVector, model: 'text-embedding-004' },
    });

    await prisma.$executeRawUnsafe(
      `UPDATE "Embedding" SET "vector" = $1::vector WHERE "id" = $2`,
      formattedVec,
      candEmb.id
    );

    // Upsert job embedding
    const jobEmb = await prisma.embedding.upsert({
      where: {
        entityType_entityId: { entityType: 'JOB', entityId: testJobId },
      },
      update: { embedding: dummyVector, model: 'text-embedding-004' },
      create: { entityType: 'JOB', entityId: testJobId, embedding: dummyVector, model: 'text-embedding-004' },
    });

    await prisma.$executeRawUnsafe(
      `UPDATE "Embedding" SET "vector" = $1::vector WHERE "id" = $2`,
      formattedVec,
      jobEmb.id
    );

    // 3. Execute pgvector cosine similarity calculation
    const similarity = await calculatePgVectorSimilarity(testCandidateId, testJobId);

    // 4. Verify PostgreSQL <=> operator returned numeric similarity close to 1.0
    expect(similarity).not.toBeNull();
    expect(typeof similarity).toBe('number');
    expect(similarity!).toBeCloseTo(1.0, 2);
  });
});
