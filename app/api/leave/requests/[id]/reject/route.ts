import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";
import { logLeaveAudit, notifyLeaveStatusChange, markLeaveApprovalNotificationsRead } from "@/lib/leave/service";
import { z } from "zod";

const schema = z.object({
  reviewNote: z.string().min(1, "Reason for rejection is required"),
});

/** Reject a leave request with a mandatory review note */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await requireRole(["SUPER_ADMIN", "HR_ADMIN"]);
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError("Validation error", parsed.error.errors[0]?.message, 400);

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { leaveType: { select: { name: true } } },
    });

    if (!leaveRequest) return apiError("Not found", "Leave request not found", 404);
    if (leaveRequest.status !== "PENDING") {
      return apiError("Invalid status", "Only PENDING requests can be rejected", 400);
    }

    const year = leaveRequest.startDate.getFullYear();

    await prisma.$transaction([
      prisma.leaveRequest.update({
        where: { id },
        data: {
          status: "REJECTED",
          reviewedById: session.id,
          reviewedAt: new Date(),
          reviewComment: parsed.data.reviewNote,
        },
      }),
      // Decrement pendingDays if any were held
      prisma.leaveBalance.updateMany({
        where: {
          employeeId: leaveRequest.employeeId,
          leaveTypeId: leaveRequest.leaveTypeId,
          year,
        },
        data: { pendingDays: { decrement: leaveRequest.workingDays } },
      }),
    ]);

    await Promise.all([
      notifyLeaveStatusChange({
        employeeId: leaveRequest.employeeId,
        leaveTypeName: leaveRequest.leaveType.name,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        status: "REJECTED",
        reviewNote: parsed.data.reviewNote,
      }),
      logLeaveAudit({
        userId: session.id,
        action: "LEAVE_REJECTED",
        targetId: id,
        newValue: {
          employeeId: leaveRequest.employeeId,
          reviewNote: parsed.data.reviewNote,
          performedBy: session.id,
        },
      }),
      markLeaveApprovalNotificationsRead(id),
    ]);

    return Response.json(apiSuccess({ id }, "Leave request rejected"));
  } catch {
    return apiError("Server error", "Failed to reject leave request", 500);
  }
}
