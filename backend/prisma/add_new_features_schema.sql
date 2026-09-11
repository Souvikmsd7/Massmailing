-- Campaign additions
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "openedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "clickedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "enableFollowUp" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "followUpDays" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "followUpSubject" TEXT;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "followUpBody" TEXT;

-- Recipient additions
ALTER TABLE "Recipient" ADD COLUMN IF NOT EXISTS "openedAt" TIMESTAMP(3);
ALTER TABLE "Recipient" ADD COLUMN IF NOT EXISTS "clickedAt" TIMESTAMP(3);
ALTER TABLE "Recipient" ADD COLUMN IF NOT EXISTS "openCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Recipient" ADD COLUMN IF NOT EXISTS "clickCount" INTEGER NOT NULL DEFAULT 0;

-- Template table
CREATE TABLE IF NOT EXISTS "Template" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"    TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "subject"   TEXT NOT NULL,
  "body"      TEXT NOT NULL,
  "createdBy" TEXT NOT NULL DEFAULT '',
  "updatedBy" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- SmtpAccount table
CREATE TABLE IF NOT EXISTS "SmtpAccount" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"     TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "host"       TEXT NOT NULL,
  "port"       INTEGER NOT NULL DEFAULT 587,
  "secure"     BOOLEAN NOT NULL DEFAULT false,
  "username"   TEXT NOT NULL,
  "password"   TEXT NOT NULL,
  "fromEmail"  TEXT NOT NULL,
  "fromName"   TEXT NOT NULL DEFAULT '',
  "dailyLimit" INTEGER NOT NULL DEFAULT 500,
  "sentToday"  INTEGER NOT NULL DEFAULT 0,
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  "createdBy"  TEXT NOT NULL DEFAULT '',
  "updatedBy"  TEXT NOT NULL DEFAULT '',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SmtpAccount_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "Template_userId_idx" ON "Template"("userId");
CREATE INDEX IF NOT EXISTS "SmtpAccount_userId_idx" ON "SmtpAccount"("userId");
