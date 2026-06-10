import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = Prisma.TransactionClient | typeof prisma;

/** Create year balances for all active leave types — idempotent via skipDuplicates */
export async function createLeaveBalancesForEmployee(
  employeeId: string,
  year = new Date().getFullYear(),
  client: DbClient = prisma
) {
  const activeLeaveTypes = await client.leaveType.findMany({
    where: { isActive: true },
    select: { id: true, defaultDays: true },
  });

  if (activeLeaveTypes.length === 0) return;

  await client.leaveBalance.createMany({
    data: activeLeaveTypes.map((leaveType) => ({
      employeeId,
      leaveTypeId: leaveType.id,
      year,
      allowance: leaveType.defaultDays,
      usedDays: 0,
      pendingDays: 0,
    })),
    skipDuplicates: true,
  });
}

/** Seed leave balances for all active employees missing current-year records */
export async function seedLeaveBalancesForAllEmployees(
  year = new Date().getFullYear()
) {
  const employees = await prisma.employee.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });

  for (const employee of employees) {
    await createLeaveBalancesForEmployee(employee.id, year);
  }
}
