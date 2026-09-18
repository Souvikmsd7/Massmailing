/*
  Warnings:

  - The values [SENDING,STOPPED] on the enum `CampaignStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [SENDING] on the enum `RecipientStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('ACTIVE', 'DEGRADED', 'DISABLED');

-- AlterEnum
BEGIN;
CREATE TYPE "CampaignStatus_new" AS ENUM ('DRAFT', 'SCHEDULED', 'PROCESSING', 'PAUSED', 'COMPLETED', 'CANCELLED', 'FAILED');
ALTER TABLE "Campaign" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Campaign" ALTER COLUMN "status" TYPE "CampaignStatus_new" USING ("status"::text::"CampaignStatus_new");
ALTER TYPE "CampaignStatus" RENAME TO "CampaignStatus_old";
ALTER TYPE "CampaignStatus_new" RENAME TO "CampaignStatus";
DROP TYPE "CampaignStatus_old";
ALTER TABLE "Campaign" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "RecipientStatus_new" AS ENUM ('PENDING', 'QUEUED', 'PROCESSING', 'SENT', 'FAILED', 'BOUNCED', 'CANCELLED');
ALTER TABLE "Recipient" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Recipient" ALTER COLUMN "status" TYPE "RecipientStatus_new" USING ("status"::text::"RecipientStatus_new");
ALTER TYPE "RecipientStatus" RENAME TO "RecipientStatus_old";
ALTER TYPE "RecipientStatus_new" RENAME TO "RecipientStatus";
DROP TYPE "RecipientStatus_old";
ALTER TABLE "Recipient" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropIndex
DROP INDEX "Embedding_vector_cosine_idx";

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "clickedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "createdBy" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "enableFollowUp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "followUpBody" TEXT,
ADD COLUMN     "followUpDays" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "followUpSubject" TEXT,
ADD COLUMN     "openedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "updatedBy" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Recipient" ADD COLUMN     "clickCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "clickedAt" TIMESTAMP(3),
ADD COLUMN     "openCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "openedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HRContact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "updatedBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HRContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "updatedBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmtpAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 587,
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT NOT NULL DEFAULT '',
    "dailyLimit" INTEGER NOT NULL DEFAULT 500,
    "sentToday" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" "ProviderStatus" NOT NULL DEFAULT 'ACTIVE',
    "concurrencyLimit" INTEGER NOT NULL DEFAULT 5,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastFailureAt" TIMESTAMP(3),
    "disabledUntil" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL DEFAULT '',
    "updatedBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmtpAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_family_idx" ON "RefreshToken"("family");

-- CreateIndex
CREATE INDEX "HRContact_userId_idx" ON "HRContact"("userId");

-- CreateIndex
CREATE INDEX "HRContact_email_idx" ON "HRContact"("email");

-- CreateIndex
CREATE INDEX "Template_userId_idx" ON "Template"("userId");

-- CreateIndex
CREATE INDEX "SmtpAccount_userId_idx" ON "SmtpAccount"("userId");

-- CreateIndex
CREATE INDEX "SmtpAccount_status_idx" ON "SmtpAccount"("status");

-- CreateIndex
CREATE INDEX "Campaign_userId_status_idx" ON "Campaign"("userId", "status");

-- CreateIndex
CREATE INDEX "Campaign_status_createdAt_idx" ON "Campaign"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Campaign_status_scheduledAt_idx" ON "Campaign"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "EmailLog_recipientId_campaignId_idx" ON "EmailLog"("recipientId", "campaignId");

-- CreateIndex
CREATE INDEX "Recipient_campaignId_status_idx" ON "Recipient"("campaignId", "status");

-- CreateIndex
CREATE INDEX "Recipient_status_updatedAt_idx" ON "Recipient"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HRContact" ADD CONSTRAINT "HRContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmtpAccount" ADD CONSTRAINT "SmtpAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
