import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getEmployeeSession } from "@/lib/employee-session";

/** Returns all leave requests for the authenticated employee */
export async function GET() {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const requests = await prisma.leaveRequest.findMany({
      where: { employeeId: session.employeeId },
      include: { leaveType: { select: { id: true, name: true } } },
      orderBy: { startDate: "desc" },
    });

    return Response.json(
      apiSuccess(
        requests.map((r) => ({
          id: r.id,
          policyId: r.leaveTypeId,
          leaveType: r.leaveType.name,
          startDate: r.startDate.toISOString().split("T")[0],
          endDate: r.endDate.toISOString().split("T")[0],
          days: r.workingDays,
          hours: r.workingHours,
          status: r.status,
          notes: r.notes,
          rejectionReason: r.reviewComment,
          createdAt: r.createdAt.toISOString(),
          submittedAt: r.submittedAt.toISOString(),
        }))
      )
    );
  } catch {
    return apiError("Server error", "Failed to fetch leave requests", 500);
  }
}
