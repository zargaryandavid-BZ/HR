import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { employeeLeaveBalancesSchema } from "@/lib/validations";
import { HOURS_PER_WORK_DAY } from "@/lib/accrual/constants";
import { hoursToAllowanceDays } from "@/lib/accrual";
import { getRemainingAccruedHours } from "@/lib/accrual/leave-validation";

type RouteParams = { params: Promise<{ id: string }> };

function isAccruedLeaveType(leaveType: {
  accrualType: string;
  slug: string | null;
}): boolean {
  return (
    leaveType.accrualType === "ACCRUED" &&
    (leaveType.slug === "pto" || leaveType.slug === "sick")
  );
}

/** List leave balances for an employee in a given year */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return apiError("Unauthorized", "Not authenticated", 401);
    }
    if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id } = await params;
    const yearParam = request.nextUrl.searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    const employee = await prisma.employee.findUnique({ where: { id }, select: { id: true } });
    if (!employee) {
      return apiError("Not found", "Employee not found", 404);
    }

    const [leaveTypes, balances] = await Promise.all([
      prisma.leaveType.findMany({ orderBy: { name: "asc" } }),
      prisma.leaveBalance.findMany({
        where: { employeeId: id, year },
        include: { leaveType: true },
      }),
    ]);

    const balanceByType = new Map(balances.map((balance) => [balance.leaveTypeId, balance]));

    const rows = leaveTypes.map((leaveType) => {
      const balance = balanceByType.get(leaveType.id);
      const accrued = isAccruedLeaveType(leaveType);
      const balanceHours = balance?.balanceHours ?? 0;
      const usedDays = balance?.usedDays ?? 0;
      const pendingDays = balance?.pendingDays ?? 0;
      const remainingHours = balance
        ? getRemainingAccruedHours(balance)
        : 0;

      return {
        leaveTypeId: leaveType.id,
        name: leaveType.name,
        slug: leaveType.slug,
        accrualType: leaveType.accrualType,
        isAccrued: accrued,
        defaultDays: leaveType.defaultDays,
        isPaid: leaveType.isPaid,
        balanceId: balance?.id ?? null,
        allowance: balance?.allowance ?? leaveType.defaultDays,
        balanceHours,
        usedDays,
        pendingDays,
        usedHours: usedDays * HOURS_PER_WORK_DAY,
        pendingHours: pendingDays * HOURS_PER_WORK_DAY,
        remainingDays: accrued
          ? remainingHours / HOURS_PER_WORK_DAY
          : (balance?.allowance ?? leaveType.defaultDays) - usedDays - pendingDays,
        remainingHours: accrued ? remainingHours : null,
      };
    });

    return Response.json(apiSuccess({ year, balances: rows }));
  } catch {
    return apiError("Server error", "Failed to fetch leave balances", 500);
  }
}

/** Upsert leave balance allowances for an employee */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return apiError("Unauthorized", "Not authenticated", 401);
    }
    if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = employeeLeaveBalancesSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const employee = await prisma.employee.findUnique({ where: { id }, select: { id: true } });
    if (!employee) {
      return apiError("Not found", "Employee not found", 404);
    }

    const { year, balances } = parsed.data;

    const leaveTypes = await prisma.leaveType.findMany({
      where: { id: { in: balances.map((b) => b.leaveTypeId) } },
      select: { id: true, defaultDays: true, accrualType: true, slug: true },
    });
    const leaveTypeMap = new Map(leaveTypes.map((lt) => [lt.id, lt]));

    await prisma.$transaction(
      balances.map((item) => {
        const leaveType = leaveTypeMap.get(item.leaveTypeId);
        if (!leaveType) {
          throw new Error(`Unknown leave type: ${item.leaveTypeId}`);
        }

        const accrued = isAccruedLeaveType(leaveType);
        const adjustmentReason = item.reason?.trim() || "Updated from employee profile";

        if (accrued) {
          if (item.balanceHours == null) {
            throw new Error(`Balance hours required for ${leaveType.slug ?? "accrued"} leave`);
          }
          const allowance = hoursToAllowanceDays(item.balanceHours);
          return prisma.leaveBalance.upsert({
            where: {
              employeeId_leaveTypeId_year: {
                employeeId: id,
                leaveTypeId: item.leaveTypeId,
                year,
              },
            },
            create: {
              employeeId: id,
              leaveTypeId: item.leaveTypeId,
              year,
              allowance,
              balanceHours: item.balanceHours,
              adjustedById: session.id,
              adjustmentReason,
            },
            update: {
              allowance,
              balanceHours: item.balanceHours,
              adjustedById: session.id,
              adjustmentReason,
            },
          });
        }

        const allowance = item.allowance ?? leaveType.defaultDays;
        return prisma.leaveBalance.upsert({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: id,
              leaveTypeId: item.leaveTypeId,
              year,
            },
          },
          create: {
            employeeId: id,
            leaveTypeId: item.leaveTypeId,
            year,
            allowance,
            adjustedById: session.id,
            adjustmentReason,
          },
          update: {
            allowance,
            adjustedById: session.id,
            adjustmentReason,
          },
        });
      })
    );

    return Response.json(apiSuccess(null, "Leave balances saved"));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Balance hours")) {
      return apiError("Validation failed", error.message);
    }
    if (error instanceof Error && error.message.startsWith("Unknown leave type")) {
      return apiError("Validation failed", error.message);
    }
    return apiError("Server error", "Failed to save leave balances", 500);
  }
}
