import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { employeeLeaveBalancesSchema } from "@/lib/validations";

type RouteParams = { params: Promise<{ id: string }> };

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
      return {
        leaveTypeId: leaveType.id,
        name: leaveType.name,
        defaultDays: leaveType.defaultDays,
        isPaid: leaveType.isPaid,
        balanceId: balance?.id ?? null,
        allowance: balance?.allowance ?? leaveType.defaultDays,
        usedDays: balance?.usedDays ?? 0,
        pendingDays: balance?.pendingDays ?? 0,
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

    await prisma.$transaction(
      balances.map((item) =>
        prisma.leaveBalance.upsert({
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
            allowance: item.allowance,
            adjustedById: session.id,
            adjustmentReason: item.reason?.trim() || "Updated from employee profile",
          },
          update: {
            allowance: item.allowance,
            adjustedById: session.id,
            adjustmentReason: item.reason?.trim() || "Updated from employee profile",
          },
        })
      )
    );

    return Response.json(apiSuccess(null, "Leave balances saved"));
  } catch {
    return apiError("Server error", "Failed to save leave balances", 500);
  }
}
