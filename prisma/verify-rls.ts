/**
 * Verify RLS is enabled and anon key cannot read application tables.
 * Run: npx dotenv -e .env.local -- npx tsx prisma/verify-rls.ts
 */
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const TABLES = [
  "AuditLog",
  "CompanySettings",
  "Department",
  "DocumentAssignment",
  "DocumentPositionLink",
  "DocumentShareLink",
  "Employee",
  "GeneratedDocument",
  "Holiday",
  "LeaveBalance",
  "LeaveRequest",
  "LeaveType",
  "LocationZone",
  "ManagerNote",
  "Notification",
  "OnboardingInstance",
  "OnboardingReminder",
  "OnboardingStep",
  "OnboardingStepProgress",
  "OnboardingTemplate",
  "PointViolation",
  "Position",
  "Sop",
  "SopAcknowledgment",
  "TimeEntry",
  "User",
  "WriteUp",
] as const;

async function verifyRlsEnabled(prisma: PrismaClient) {
  const rows = await prisma.$queryRaw<
    { table_name: string; rls_enabled: boolean }[]
  >`
    SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname = ANY(${TABLES})
    ORDER BY c.relname
  `;

  const disabled = rows.filter((r) => !r.rls_enabled);
  if (disabled.length > 0) {
    throw new Error(`RLS not enabled: ${disabled.map((r) => r.table_name).join(", ")}`);
  }

  console.log(`✓ RLS enabled on all ${rows.length} tables`);
}

async function verifyAnonBlocked() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase.from("Employee").select("id").limit(1);

  if (data && data.length > 0) {
    throw new Error("SECURITY: anon key can read Employee table!");
  }

  // PostgREST returns empty array or error when RLS blocks — both are acceptable
  console.log("✓ Anon key blocked from direct Employee access", error ? `(error: ${error.message})` : "(empty result)");
}

async function verifyPrismaWorks(prisma: PrismaClient) {
  const [employees, users] = await Promise.all([
    prisma.employee.count(),
    prisma.user.count(),
  ]);
  console.log(`✓ Prisma queries work (employees: ${employees}, users: ${users})`);
}

async function verifyServiceRoleWorks() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await supabase.from("Employee").select("id").limit(1);

  if (error) {
    throw new Error(`Service role query failed: ${error.message}`);
  }

  console.log(`✓ Service role can query tables (${data?.length ?? 0} rows returned)`);
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await verifyRlsEnabled(prisma);
    await verifyAnonBlocked();
    await verifyPrismaWorks(prisma);
    await verifyServiceRoleWorks();
    console.log("\nAll RLS checks passed.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("\nRLS verification FAILED:", err.message);
  process.exit(1);
});
