import { prisma } from "@/lib/prisma";
import { processAccrual } from "@/lib/accrual";
import { getTotalHoursFromTimeEntries } from "@/lib/accrual/hours-estimate";

export type RunAccrualResult = {
  employeeId: string;
  hoursProcessed: number;
  pto: { hoursEarned: number; newBalance: number } | null;
  sick: { hoursEarned: number; newBalance: number } | null;
};

/** Process incremental accrual from time entries not yet credited */
export async function runAccrualForEmployee(employeeId: string): Promise<RunAccrualResult | null> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { position: { include: { accrualPolicy: true } } },
  });

  if (!employee?.position?.accrualPolicy) return null;

  const totalHours = await getTotalHoursFromTimeEntries(employeeId);
  const year = new Date().getFullYear();

  const balances = await prisma.leaveBalance.findMany({
    where: {
      employeeId,
      year,
      leaveType: { slug: { in: ["pto", "sick"] } },
    },
    include: { leaveType: { select: { slug: true } } },
  });

  const maxAccruedHours = balances.reduce(
    (max, balance) => Math.max(max, balance.accrualHoursWorked),
    0
  );
  const deltaHours = Math.max(0, totalHours - maxAccruedHours);

  if (deltaHours <= 0) {
    return {
      employeeId,
      hoursProcessed: 0,
      pto: null,
      sick: null,
    };
  }

  const [pto, sick] = await Promise.all([
    processAccrual(employeeId, "pto", deltaHours),
    processAccrual(employeeId, "sick", deltaHours),
  ]);

  return {
    employeeId,
    hoursProcessed: deltaHours,
    pto: pto
      ? { hoursEarned: pto.hoursEarned, newBalance: pto.newBalance }
      : null,
    sick: sick
      ? { hoursEarned: sick.hoursEarned, newBalance: sick.newBalance }
      : null,
  };
}
