-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "MatchStatus" AS ENUM ('CALCULATING', 'READY', 'FAILED', 'STALE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable JobMatch
CREATE TABLE IF NOT EXISTS "JobMatch" (
    "id" TEXT NOT NULL,
    "candidateProfileId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "hardFilterScore" DOUBLE PRECISION NOT NULL,
    "skillScore" DOUBLE PRECISION NOT NULL,
    "semanticScore" DOUBLE PRECISION NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'CALCULATING',
    "hardFilterResults" JSONB,
    "skillMatchResults" JSONB,
    "explanation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable Embedding
CREATE TABLE IF NOT EXISTS "Embedding" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "vector" vector(768),
    "model" TEXT NOT NULL,
    "contentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Embedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes for JobMatch
CREATE UNIQUE INDEX IF NOT EXISTS "JobMatch_candidateProfileId_jobId_key" ON "JobMatch"("candidateProfileId", "jobId");
CREATE INDEX IF NOT EXISTS "JobMatch_candidateProfileId_idx" ON "JobMatch"("candidateProfileId");
CREATE INDEX IF NOT EXISTS "JobMatch_jobId_idx" ON "JobMatch"("jobId");
CREATE INDEX IF NOT EXISTS "JobMatch_status_idx" ON "JobMatch"("status");
CREATE INDEX IF NOT EXISTS "JobMatch_overallScore_idx" ON "JobMatch"("overallScore");

-- Foreign Keys for JobMatch
ALTER TABLE "JobMatch" DROP CONSTRAINT IF EXISTS "JobMatch_candidateProfileId_fkey";
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_candidateProfileId_fkey" FOREIGN KEY ("candidateProfileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobMatch" DROP CONSTRAINT IF EXISTS "JobMatch_jobId_fkey";
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndexes for Embedding
CREATE UNIQUE INDEX IF NOT EXISTS "Embedding_entityType_entityId_key" ON "Embedding"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "Embedding_entityType_entityId_idx" ON "Embedding"("entityType", "entityId");

-- Ensure vector column exists if Embedding table was created previously without vector type
ALTER TABLE "Embedding" ADD COLUMN IF NOT EXISTS "vector" vector(768);

-- Create HNSW Cosine Index for pgvector
CREATE INDEX IF NOT EXISTS "Embedding_vector_cosine_idx" ON "Embedding" USING hnsw (vector vector_cosine_ops);


