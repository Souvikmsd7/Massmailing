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
    // 1. Verify pgvector extension exists explicitly (fails test if extension unavailable)
    const extResult = await prisma.$queryRawUnsafe<Array<{ extname: string }>>(
      `SELECT extname FROM pg_extension WHERE extname = 'vector'`
    );
    const vectorSupported = extResult && extResult.length > 0;
    expect(vectorSupported).toBe(true);

    // 2. Create candidate & job embedding records with 768-dim unit vector
    const dummyVector = new Array(768).fill(0.1);
    const formattedVec = `[${dummyVector.join(',')}]`;

    // Candidate embedding
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

    // Job embedding
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

    // 3. Explicitly verify Candidate and Job vector columns are populated (NOT NULL)
    const candVectorCheck = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT COUNT(*)::int as count FROM "Embedding" WHERE "id" = $1 AND "vector" IS NOT NULL`,
      candEmb.id
    );
    expect(candVectorCheck[0].count).toBe(1);

    const jobVectorCheck = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT COUNT(*)::int as count FROM "Embedding" WHERE "id" = $1 AND "vector" IS NOT NULL`,
      jobEmb.id
    );
    expect(jobVectorCheck[0].count).toBe(1);

    // 4. Call calculatePgVectorSimilarity to execute native PostgreSQL <=> query
    const similarity = await calculatePgVectorSimilarity(testCandidateId, testJobId);

    // 5 & 6. Verify returned similarity is numeric and identical vectors produce ~1.0
    expect(similarity).not.toBeNull();
    expect(typeof similarity).toBe('number');
    expect(similarity!).toBeCloseTo(1.0, 2);
  });
});
