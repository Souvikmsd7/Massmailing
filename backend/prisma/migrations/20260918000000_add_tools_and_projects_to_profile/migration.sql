-- AlterTable
ALTER TABLE "CandidateProfile" ADD COLUMN "tools" JSONB DEFAULT '[]',
ADD COLUMN "projects" JSONB DEFAULT '[]';
