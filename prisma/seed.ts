import { PrismaClient } from "@prisma/client";
import { FEDERAL_HOLIDAYS_2025_2027 } from "../lib/utils/federal-holidays";
import { seedLeaveBalancesForAllEmployees } from "../lib/leave/balances";
import { ensureDefaultAccrualPolicy } from "../lib/accrual";

const prisma = new PrismaClient();

/** Seed default departments, leave types, and company settings */
async function main() {
  const departments = ["Production", "Sales", "Administration", "Shipping"];
  for (const name of departments) {
    await prisma.department.upsert({
      where: { id: name.toLowerCase() },
      update: {},
      create: { id: name.toLowerCase(), name, description: `${name} department` },
    }).catch(() =>
      prisma.department.create({ data: { name, description: `${name} department` } })
    );
  }

  const leaveTypes = [
    { name: "PTO", slug: "pto", defaultDays: 0, accrualType: "ACCRUED" as const, isPaid: true, carryOver: true },
    { name: "Sick Leave", slug: "sick", defaultDays: 0, accrualType: "ACCRUED" as const, isPaid: true, carryOver: true },
    { name: "Personal", slug: "personal", defaultDays: 3, accrualType: "LUMP_SUM" as const, isPaid: true, carryOver: false },
    { name: "Unpaid Leave", slug: "unpaid", defaultDays: 0, accrualType: "LUMP_SUM" as const, isPaid: false, carryOver: false },
  ];

  for (const lt of leaveTypes) {
    const existing = await prisma.leaveType.findFirst({ where: { name: lt.name } });
    if (existing) {
      await prisma.leaveType.update({
        where: { id: existing.id },
        data: {
          slug: lt.slug,
          defaultDays: lt.defaultDays,
          accrualType: lt.accrualType,
          isPaid: lt.isPaid,
          carryOver: lt.carryOver,
          isActive: true,
        },
      });
    } else {
      await prisma.leaveType.create({ data: lt });
    }
  }

  const positions = await prisma.position.findMany({ select: { id: true } });
  for (const position of positions) {
    await ensureDefaultAccrualPolicy(position.id);
  }
  console.log(`✓ Seeded accrual policies for ${positions.length} positions`);

  await prisma.companySettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  const holidayResult = await prisma.holiday.createMany({
    data: FEDERAL_HOLIDAYS_2025_2027,
    skipDuplicates: true,
  });
  console.log(`✓ Seeded ${holidayResult.count} holidays (2025–2027)`);

  await seedLeaveBalancesForAllEmployees();
  console.log("✓ Seeded leave balances for active employees");

  console.log("Seed completed.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
