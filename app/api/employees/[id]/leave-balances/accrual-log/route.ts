import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

type RouteParams = { params: Promise<{ id: string }> };

/** Returns accrual log entries for an employee, optionally filtered by leave type */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { id: employeeId } = await params;
    const leaveTypeId = request.nextUrl.searchParams.get("leaveTypeId");

    const logs = await prisma.leaveAccrualLog.findMany({
      where: {
        employeeId,
        ...(leaveTypeId ? { leaveTypeId } : {}),
      },
      include: {
        leaveType: { select: { name: true, slug: true } },
        adjustedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return Response.json(
      apiSuccess(
        logs.map((log) => ({
          id: log.id,
          type: log.type,
          leaveTypeName: log.leaveType.name,
          hoursWorked: log.hoursWorked,
          hoursEarned: log.hoursEarned,
          balanceAfter: log.balanceAfter,
          note: log.note,
          adjustedBy: log.adjustedBy?.name ?? log.adjustedBy?.email ?? null,
          createdAt: log.createdAt.toISOString(),
        }))
      )
    );
  } catch {
    return apiError("Server error", "Failed to fetch accrual log", 500);
  }
}
