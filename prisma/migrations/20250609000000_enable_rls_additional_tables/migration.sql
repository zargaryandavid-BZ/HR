-- Enable RLS on tables added after the initial RLS migration.

ALTER TABLE "DocumentAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentPositionLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentShareLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GeneratedDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ManagerNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WriteUp" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny anon direct access" ON "DocumentAssignment"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny anon direct access" ON "DocumentPositionLink"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny anon direct access" ON "DocumentShareLink"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny anon direct access" ON "GeneratedDocument"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny anon direct access" ON "ManagerNote"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny anon direct access" ON "WriteUp"
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated direct access" ON "DocumentAssignment"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated direct access" ON "DocumentPositionLink"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated direct access" ON "DocumentShareLink"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated direct access" ON "GeneratedDocument"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated direct access" ON "ManagerNote"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated direct access" ON "WriteUp"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
