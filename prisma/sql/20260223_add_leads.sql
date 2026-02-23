-- Lead capture system: add leads table + enums
-- This repo currently does not keep Prisma migrations in source control.
-- Apply this manually (or generate a proper migration from your existing migration baseline).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LeadType') THEN
    CREATE TYPE "LeadType" AS ENUM ('DEMO', 'CONTACT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LeadStatus') THEN
    CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CLOSED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "leads" (
  "id" TEXT PRIMARY KEY,
  "type" "LeadType" NOT NULL,
  "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NULL,
  "company" TEXT NULL,
  "country" TEXT NOT NULL,
  "companySize" TEXT NULL,
  "message" TEXT NOT NULL,
  "marketingOptIn" BOOLEAN NOT NULL DEFAULT FALSE,
  "consentAccepted" BOOLEAN NOT NULL,
  "utmSource" TEXT NULL,
  "utmMedium" TEXT NULL,
  "utmCampaign" TEXT NULL,
  "pagePath" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "leads_createdAt_idx" ON "leads" ("createdAt");
CREATE INDEX IF NOT EXISTS "leads_status_idx" ON "leads" ("status");
CREATE INDEX IF NOT EXISTS "leads_type_status_createdAt_idx" ON "leads" ("type", "status", "createdAt");

