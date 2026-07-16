import { getSession } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { calculatePointSummary } from "@/lib/points-server";

/** List active employees with their current point standing. */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) return apiError("Forbidden", "Not authorized", 403);
    const now = new Date();
    await prisma.pointViolation.updateMany({ where: { expiresAt: { lte: now }, isExpired: false }, data: { isExpired: true } });
    const employees = await prisma.employee.findMany({
      where: { status: "ACTIVE" },
      include: { pointViolations: { where: { isExpired: false, expiresAt: { gt: now } } }, department: { select: { name: true } }, position: { select: { name: true } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
    return Response.json(apiSuccess(employees.map((employee) => {
      const summary = calculatePointSummary(employee.pointViolations, now);
      return {
        employeeId: employee.id, firstName: employee.firstName, lastName: employee.lastName, preferredName: employee.preferredName,
        department: employee.department?.name ?? null, position: employee.position?.name ?? employee.jobTitle ?? null,
        totalPoints: summary.totalActivePoints, tier: summary.tier.tier,
        activeViolationCount: summary.activeViolations.length, nextExpiry: summary.nextExpiry?.toISOString() ?? null,
      };
    }).sort((a, b) => b.totalPoints - a.totalPoints)));
  } catch {
    return apiError("Server error", "Failed to fetch points data", 500);
  }
}
