-- Add optional hour amount for partial-day leave requests (e.g. 2 hours PTO)
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "workingHours" DOUBLE PRECISION;
