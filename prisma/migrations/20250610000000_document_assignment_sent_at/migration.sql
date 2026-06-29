-- Add manual assignment and send tracking to onboarding document assignments
ALTER TABLE "DocumentAssignment" ADD COLUMN IF NOT EXISTS "assignedManually" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DocumentAssignment" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);

-- Existing assignments were already visible to employees — treat as sent
UPDATE "DocumentAssignment" SET "sentAt" = "assignedAt" WHERE "sentAt" IS NULL;

CREATE INDEX IF NOT EXISTS "DocumentAssignment_employeeId_sentAt_idx" ON "DocumentAssignment"("employeeId", "sentAt");
