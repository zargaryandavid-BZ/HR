import { NextRequest } from "next/server";
import { format } from "date-fns";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

type RouteParams = { params: Promise<{ id: string }> };

/** List all compensation history records for an employee, newest first */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    if (!["HR_ADMIN", "SUPER_ADMIN", "MANAGER"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id: employeeId } = await params;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) return apiError("Not found", "Employee not found", 404);

    const records = await prisma.compensationHistory.findMany({
      where: { employeeId },
      orderBy: { effectiveDate: "desc" },
    });

    const changerIds = [...new Set(records.map((r) => r.changedBy))];
    const users = await prisma.user.findMany({
      where: { id: { in: changerIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.name?.trim() || u.email]));

    const items = records.map((r) => ({
      id: r.id,
      previousRate: r.previousRate,
      newRate: r.newRate,
      payType: r.payType,
      effectiveDate: format(r.effectiveDate, "MMM d, yyyy"),
      changedBy: userMap.get(r.changedBy) ?? "Unknown",
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    }));

    return Response.json(apiSuccess(items));
  } catch {
    return apiError("Server error", "Failed to fetch compensation history", 500);
  }
}
