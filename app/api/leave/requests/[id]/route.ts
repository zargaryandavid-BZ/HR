import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";

/** Returns a single leave request with full details for the detail drawer */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireRole(["SUPER_ADMIN", "HR_ADMIN", "MANAGER"]);

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            department: { select: { name: true } },
          },
        },
        leaveType: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!leaveRequest) return apiError("Not found", "Leave request not found", 404);

    const currentYear = leaveRequest.startDate.getFullYear();
    const balance = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: leaveRequest.employeeId,
          leaveTypeId: leaveRequest.leaveTypeId,
          year: currentYear,
        },
      },
    });

    const auditLogs = await prisma.auditLog.findMany({
      where: { targetId: id, targetTable: "LeaveRequest" },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });

    const totalDays = balance?.allowance ?? 0;
    const usedDays = balance?.usedDays ?? 0;

    return Response.json(
      apiSuccess({
        id: leaveRequest.id,
        employee: {
          id: leaveRequest.employee.id,
          firstName: leaveRequest.employee.firstName,
          lastName: leaveRequest.employee.lastName,
          jobTitle: leaveRequest.employee.jobTitle,
          department: leaveRequest.employee.department,
          avatarInitials: `${leaveRequest.employee.firstName[0]}${leaveRequest.employee.lastName[0]}`.toUpperCase(),
        },
        policy: { id: leaveRequest.leaveType.id, name: leaveRequest.leaveType.name },
        startDate: leaveRequest.startDate.toISOString().split("T")[0],
        endDate: leaveRequest.endDate.toISOString().split("T")[0],
        workingDays: leaveRequest.workingDays,
        status: leaveRequest.status,
        note: leaveRequest.notes,
        reviewNote: leaveRequest.reviewComment,
        reviewedBy: leaveRequest.reviewedBy
          ? { name: leaveRequest.reviewedBy.name, email: leaveRequest.reviewedBy.email }
          : null,
        reviewedAt: leaveRequest.reviewedAt?.toISOString() ?? null,
        createdAt: leaveRequest.createdAt.toISOString(),
        balance: { totalDays, usedDays, remainingDays: totalDays - usedDays },
        auditLog: auditLogs.map((log) => ({
          action: log.action,
          performedBy: log.user.name ?? log.user.email,
          createdAt: log.createdAt.toISOString(),
          newValue: log.newValue,
        })),
      })
    );
  } catch {
    return apiError("Server error", "Failed to fetch leave request", 500);
  }
}
