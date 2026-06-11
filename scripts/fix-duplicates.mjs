// Finds and removes duplicate employees (by workEmail and phone).
// Keeps the NEWEST record, deletes the older ones + all their related data.
import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ── Load .env.local manually ──────────────────────────────────────────────────
const envPath = resolve(__dirname, "../.env.local");
const envLines = readFileSync(envPath, "utf8").split("\n");
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
  process.env[key] = val;
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function deleteCascade(tx, employeeId) {
  // Delete in dependency order (children first)
  await tx.breakEntry.deleteMany({
    where: { timeEntry: { employeeId } },
  });
  await tx.timeEntry.deleteMany({ where: { employeeId } });
  await tx.leaveAccrualLog.deleteMany({ where: { employeeId } });
  await tx.leaveRequest.deleteMany({ where: { employeeId } });
  await tx.leaveBalance.deleteMany({ where: { employeeId } });
  await tx.notification.deleteMany({ where: { employeeId } });
  await tx.writeUp.deleteMany({ where: { employeeId } });
  await tx.managerNote.deleteMany({ where: { employeeId } });
  await tx.generatedDocument.deleteMany({ where: { employeeId } });
  await tx.employeeImpersonationToken.deleteMany({ where: { employeeId } });
  await tx.documentShareLink.deleteMany({ where: { employeeId } });
  await tx.compensationHistory.deleteMany({ where: { employeeId } });
  await tx.employeeIdentityDocument.deleteMany({ where: { employeeId } });
  await tx.onboardingStepProgress.deleteMany({
    where: { instance: { employeeId } },
  });
  await tx.onboardingReminder.deleteMany({
    where: { instance: { employeeId } },
  });
  await tx.onboardingInstance.deleteMany({ where: { employeeId } });
  await tx.offboardingStepProgress.deleteMany({
    where: { instance: { employeeId } },
  });
  await tx.offboardingInstance.deleteMany({ where: { employeeId } });
  await tx.sopAcknowledgment.deleteMany({ where: { employeeId } });
  await tx.documentAssignment.deleteMany({ where: { employeeId } });
  // Nullify manager references on direct reports
  await tx.employee.updateMany({
    where: { managerId: employeeId },
    data: { managerId: null },
  });
  // Nullify employee → user link
  await tx.user.updateMany({
    where: { employeeId },
    data: { employeeId: null },
  });
  await tx.employee.delete({ where: { id: employeeId } });
}

async function main() {
  // ── Find duplicates ──────────────────────────────────────────────────────
  const emailDups = await prisma.$queryRaw`
    SELECT "workEmail", COUNT(*) AS cnt,
           array_agg(id ORDER BY "createdAt" DESC) AS ids
    FROM "Employee"
    WHERE "workEmail" IS NOT NULL AND "workEmail" != ''
    GROUP BY "workEmail"
    HAVING COUNT(*) > 1
  `;

  const phoneDups = await prisma.$queryRaw`
    SELECT phone, COUNT(*) AS cnt,
           array_agg(id ORDER BY "createdAt" DESC) AS ids
    FROM "Employee"
    WHERE phone IS NOT NULL AND phone != ''
    GROUP BY phone
    HAVING COUNT(*) > 1
  `;

  // Collect IDs to delete (keep first = newest, delete the rest)
  const toDelete = new Set();

  for (const row of emailDups) {
    const [_keep, ...dupes] = row.ids;
    console.log(`Duplicate email "${row.workEmail}": keeping ${_keep}, deleting ${dupes.join(", ")}`);
    dupes.forEach((id) => toDelete.add(id));
  }

  for (const row of phoneDups) {
    const [_keep, ...dupes] = row.ids;
    console.log(`Duplicate phone "${row.phone}": keeping ${_keep}, deleting ${dupes.join(", ")}`);
    dupes.forEach((id) => toDelete.add(id));
  }

  if (toDelete.size === 0) {
    console.log("✅  No duplicates found — database is clean.");
    return;
  }

  console.log(`\nDeleting ${toDelete.size} duplicate employee record(s)...`);

  for (const employeeId of toDelete) {
    await prisma.$transaction(async (tx) => {
      console.log(`  → Deleting employee ${employeeId}`);
      await deleteCascade(tx, employeeId);
    });
  }

  console.log("✅  Done. All duplicates removed.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
