-- Phase 2: Job Discovery & Ingestion
-- Adds Job model with deduplication, posted-date confidence, and normalization support

-- CreateEnum
CREATE TYPE "RemoteType" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PostedAtConfidence" AS ENUM ('EXACT', 'APPROXIMATE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'DUPLICATE');

-- CreateTable
CREATE TABLE "Job" (
    "id"                 TEXT NOT NULL,
    "title"              TEXT NOT NULL,
    "normalizedTitle"    TEXT NOT NULL,
    "description"        TEXT,
    "company"            TEXT NOT NULL,
    "companyUrl"         TEXT,
    "jobUrl"             TEXT NOT NULL,
    "source"             TEXT NOT NULL,
    "sourceJobId"        TEXT,
    "location"           TEXT,
    "normalizedLocation" TEXT,
    "remoteType"         "RemoteType"         NOT NULL DEFAULT 'UNKNOWN',
    "employmentType"     "EmploymentType"     NOT NULL DEFAULT 'UNKNOWN',
    "salaryMin"          INTEGER,
    "salaryMax"          INTEGER,
    "salaryCurrency"     TEXT,
    "postedAt"           TIMESTAMP(3),
    "postedAtConfidence" "PostedAtConfidence" NOT NULL DEFAULT 'UNKNOWN',
    "discoveredAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentHash"        TEXT NOT NULL,
    "status"             "JobStatus"          NOT NULL DEFAULT 'ACTIVE',
    "skills"             TEXT[],
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Job_contentHash_key"        ON "Job"("contentHash");
CREATE UNIQUE INDEX "Job_source_sourceJobId_key"  ON "Job"("source", "sourceJobId");

CREATE INDEX "Job_status_idx"          ON "Job"("status");
CREATE INDEX "Job_remoteType_idx"      ON "Job"("remoteType");
CREATE INDEX "Job_employmentType_idx"  ON "Job"("employmentType");
CREATE INDEX "Job_discoveredAt_idx"    ON "Job"("discoveredAt");
CREATE INDEX "Job_postedAt_idx"        ON "Job"("postedAt");
CREATE INDEX "Job_company_idx"         ON "Job"("company");
CREATE INDEX "Job_normalizedTitle_idx" ON "Job"("normalizedTitle");
