CREATE TABLE IF NOT EXISTS "HRContact" (
  "id"        TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"    TEXT        NOT NULL,
  "name"      TEXT        NOT NULL,
  "company"   TEXT        NOT NULL DEFAULT '',
  "email"     TEXT        NOT NULL,
  "phone"     TEXT        NOT NULL DEFAULT '',
  "location"  TEXT        NOT NULL DEFAULT '',
  "notes"     TEXT        NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "HRContact_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HRContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "HRContact_userId_idx" ON "HRContact"("userId");
CREATE INDEX IF NOT EXISTS "HRContact_email_idx"  ON "HRContact"("email");
