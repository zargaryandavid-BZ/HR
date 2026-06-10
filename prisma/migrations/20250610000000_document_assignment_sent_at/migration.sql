-- Add manual assignment and send tracking to onboarding document assignments
ALTER TABLE "DocumentAssignment" ADD COLUMN "assignedManually" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DocumentAssignment" ADD COLUMN "sentAt" TIMESTAMP(3);

-- Existing assignments were already visible to employees — treat as sent
UPDATE "DocumentAssignment" SET "sentAt" = "assignedAt" WHERE "sentAt" IS NULL;

CREATE INDEX "DocumentAssignment_employeeId_sentAt_idx" ON "DocumentAssignment"("employeeId", "sentAt");
