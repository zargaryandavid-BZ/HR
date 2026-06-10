import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";
import { logLeaveAudit } from "@/lib/leave/service";

/** Undo an approved leave request (only if start date has not yet passed) */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await requireRole(["SUPER_ADMIN", "HR_ADMIN"]);

    const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id } });

    if (!leaveRequest) return apiError("Not found", "Leave request not found", 404);
    if (leaveRequest.status !== "APPROVED") {
      return apiError("Invalid status", "Only APPROVED requests can be undone", 400);
    }
    if (leaveRequest.startDate <= new Date()) {
      return apiError("Forbidden", "Cannot undo a leave request that has already started", 403);
    }

    const year = leaveRequest.startDate.getFullYear();

    await prisma.$transaction([
      prisma.leaveRequest.update({
        where: { id },
        data: {
          status: "PENDING",
          reviewedById: null,
          reviewedAt: null,
          reviewComment: null,
        },
      }),
      prisma.leaveBalance.updateMany({
        where: {
          employeeId: leaveRequest.employeeId,
          leaveTypeId: leaveRequest.leaveTypeId,
          year,
        },
        data: { usedDays: { decrement: leaveRequest.workingDays } },
      }),
    ]);

    await logLeaveAudit({
      userId: session.id,
      action: "LEAVE_APPROVAL_UNDONE",
      targetId: id,
      newValue: { employeeId: leaveRequest.employeeId, performedBy: session.id },
    });

    return Response.json(apiSuccess({ id }, "Leave approval undone"));
  } catch {
    return apiError("Server error", "Failed to undo leave approval", 500);
  }
}
