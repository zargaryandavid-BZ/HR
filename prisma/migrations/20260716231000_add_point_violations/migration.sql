CREATE TABLE "PointViolation" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "points" DOUBLE PRECISION NOT NULL,
  "reason" TEXT NOT NULL,
  "violationType" TEXT,
  "incidentDate" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "isExpired" BOOLEAN NOT NULL DEFAULT false,
  "addedById" TEXT NOT NULL,
  "editedAt" TIMESTAMP(3),
  "editedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PointViolation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PointViolation_employeeId_isExpired_expiresAt_idx"
  ON "PointViolation"("employeeId", "isExpired", "expiresAt");
CREATE INDEX "PointViolation_incidentDate_idx"
  ON "PointViolation"("incidentDate");

ALTER TABLE "PointViolation"
  ADD CONSTRAINT "PointViolation_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointViolation"
  ADD CONSTRAINT "PointViolation_addedById_fkey"
  FOREIGN KEY ("addedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PointViolation"
  ADD CONSTRAINT "PointViolation_editedById_fkey"
  FOREIGN KEY ("editedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PointViolation" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny anon direct access" ON "PointViolation"
  FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny authenticated direct access" ON "PointViolation"
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
