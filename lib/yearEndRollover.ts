import { prisma } from "@/lib/prisma";
import { hoursToAllowanceDays } from "@/lib/accrual";

/** Run year-end PTO forfeiture and sick leave rollover logging for all active employees */
export async function runYearEndRollover() {
  const employees = await prisma.employee.findMany({
    where: { status: "ACTIVE" },
    include: {
      position: { include: { accrualPolicy: true } },
      leaveBalances: {
        where: { year: new Date().getFullYear() },
        include: { leaveType: { select: { slug: true, name: true } } },
      },
    },
  });

  let processed = 0;

  for (const employee of employees) {
    const policy = employee.position?.accrualPolicy;
    if (!policy) continue;

    for (const balance of employee.leaveBalances) {
      const slug = balance.leaveType.slug;
      if (!slug) continue;

      if (slug === "sick") {
        await prisma.leaveAccrualLog.create({
          data: {
            employeeId: employee.id,
            leaveTypeId: balance.leaveTypeId,
            type: "YEAR_END_ROLLOVER",
            hoursEarned: 0,
            balanceAfter: balance.balanceHours,
            note: `Year-end rollover: sick leave carries over in full (${balance.balanceHours} hrs)`,
          },
        });
        await prisma.leaveBalance.update({
          where: { id: balance.id },
          data: { yearStartBalance: balance.balanceHours },
        });
        processed++;
      }

      if (slug === "pto") {
        const rolloverCap = policy.ptoRolloverCapHours;
        if (balance.balanceHours > rolloverCap) {
          const forfeited = balance.balanceHours - rolloverCap;
          await prisma.leaveBalance.update({
            where: { id: balance.id },
            data: {
              balanceHours: rolloverCap,
              allowance: hoursToAllowanceDays(rolloverCap),
              yearStartBalance: rolloverCap,
            },
          });
          await prisma.leaveAccrualLog.create({
            data: {
              employeeId: employee.id,
              leaveTypeId: balance.leaveTypeId,
              type: "YEAR_END_ROLLOVER",
              hoursEarned: -forfeited,
              balanceAfter: rolloverCap,
              note: `Year-end: ${balance.balanceHours} hrs → ${rolloverCap} hrs (${forfeited} hrs forfeited, rollover cap: ${rolloverCap} hrs)`,
            },
          });
        } else {
          await prisma.leaveBalance.update({
            where: { id: balance.id },
            data: { yearStartBalance: balance.balanceHours },
          });
          await prisma.leaveAccrualLog.create({
            data: {
              employeeId: employee.id,
              leaveTypeId: balance.leaveTypeId,
              type: "YEAR_END_ROLLOVER",
              hoursEarned: 0,
              balanceAfter: balance.balanceHours,
              note: `Year-end rollover: ${balance.balanceHours} hrs carried over (under cap)`,
            },
          });
        }
        processed++;
      }
    }
  }

  return { processed };
}
