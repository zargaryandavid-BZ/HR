-- Enable Row Level Security on all application tables.
--
-- Security model:
--   • anon role (NEXT_PUBLIC_SUPABASE_ANON_KEY): auth only — no direct table access
--   • service_role (SUPABASE_SERVICE_ROLE_KEY): bypasses RLS automatically
--   • Prisma (DATABASE_URL / postgres role): bypasses RLS automatically
--
-- Apply with: npx dotenv -e .env.local -- prisma migrate deploy
-- Or paste into the Supabase SQL Editor.

-- ── Enable RLS ──────────────────────────────────────────────────────────────

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompanySettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Department" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Employee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Holiday" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveBalance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveType" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LocationZone" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OnboardingInstance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OnboardingReminder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OnboardingStep" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OnboardingStepProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OnboardingTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Position" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Sop" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SopAcknowledgment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimeEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

-- ── Deny anon direct table access ───────────────────────────────────────────
-- Blocks SELECT, INSERT, UPDATE, DELETE via PostgREST with the anon key.
-- service_role bypasses RLS; no policy needed for it.

CREATE POLICY "Deny anon direct access" ON "AuditLog"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny anon direct access" ON "CompanySettings"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny anon direct access" ON "Department"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny anon direct access" ON "Employee"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny anon direct access" ON "Holiday"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny anon direct access" ON "LeaveBalance"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny anon direct access" ON "LeaveRequest"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny anon direct access" ON "LeaveType"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny anon direct access" ON "LocationZone"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny anon direct access" ON "Notification"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny anon direct access" ON "OnboardingInstance"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny anon direct access" ON "OnboardingReminder"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny anon direct access" ON "OnboardingStep"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny anon direct access" ON "OnboardingStepProgress"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny anon direct access" ON "OnboardingTemplate"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny anon direct access" ON "Position"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny anon direct access" ON "Sop"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny anon direct access" ON "SopAcknowledgment"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny anon direct access" ON "TimeEntry"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny anon direct access" ON "User"
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- Also block authenticated role — logged-in users must use API routes (Prisma),
-- not direct PostgREST table access with their session JWT.

CREATE POLICY "Deny authenticated direct access" ON "AuditLog"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated direct access" ON "CompanySettings"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated direct access" ON "Department"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated direct access" ON "Employee"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated direct access" ON "Holiday"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated direct access" ON "LeaveBalance"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated direct access" ON "LeaveRequest"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated direct access" ON "LeaveType"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated direct access" ON "LocationZone"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated direct access" ON "Notification"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated direct access" ON "OnboardingInstance"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated direct access" ON "OnboardingReminder"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated direct access" ON "OnboardingStep"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated direct access" ON "OnboardingStepProgress"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated direct access" ON "OnboardingTemplate"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated direct access" ON "Position"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated direct access" ON "Sop"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated direct access" ON "SopAcknowledgment"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated direct access" ON "TimeEntry"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated direct access" ON "User"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
