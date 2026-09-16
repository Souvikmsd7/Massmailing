-- Phase 2 Hardening: Add canonical job URL for URL-based deduplication
--
-- canonicalJobUrl stores the tracking-stripped, normalized URL of the job posting.
-- This enables deduplication by URL as the second priority (after source+sourceJobId,
-- before contentHash).
--
-- The column is nullable because:
--   1. Existing rows do not have this computed
--   2. Malformed URLs that cannot be normalized remain NULL

-- AlterTable
ALTER TABLE "Job" ADD COLUMN "canonicalJobUrl" TEXT;

-- CreateIndex
CREATE INDEX "Job_canonicalJobUrl_idx" ON "Job"("canonicalJobUrl");
