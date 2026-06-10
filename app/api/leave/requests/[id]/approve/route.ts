import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";
import { logLeaveAudit, notifyLeaveStatusChange, markLeaveApprovalNotificationsRead } from "@/lib/leave/service";
import { z } from "zod";

const schema = z.object({ reviewNote: z.string().optional() });

/** Approve a leave request and update the employee's leave balance */
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
      include: { leaveType: { select: { name: true, defaultDays: true } } },
    });

    if (!leaveRequest) return apiError("Not found", "Leave request not found", 404);
    if (leaveRequest.status !== "PENDING") {
      return apiError("Invalid status", "Only PENDING requests can be approved", 400);
    }

    const year = leaveRequest.startDate.getFullYear();

    await prisma.$transaction([
      prisma.leaveRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedById: session.id,
          reviewedAt: new Date(),
          reviewComment: parsed.data.reviewNote ?? null,
        },
      }),
      prisma.leaveBalance.upsert({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: leaveRequest.employeeId,
            leaveTypeId: leaveRequest.leaveTypeId,
            year,
          },
        },
        create: {
          employeeId: leaveRequest.employeeId,
          leaveTypeId: leaveRequest.leaveTypeId,
          year,
          allowance: leaveRequest.leaveType.defaultDays,
          usedDays: leaveRequest.workingDays,
          pendingDays: 0,
        },
        update: {
          usedDays: { increment: leaveRequest.workingDays },
          pendingDays: { decrement: leaveRequest.workingDays },
        },
      }),
    ]);

    await Promise.all([
      notifyLeaveStatusChange({
        employeeId: leaveRequest.employeeId,
        leaveTypeName: leaveRequest.leaveType.name,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        status: "APPROVED",
      }),
      logLeaveAudit({
        userId: session.id,
        action: "LEAVE_APPROVED",
        targetId: id,
        newValue: {
          employeeId: leaveRequest.employeeId,
          workingDays: leaveRequest.workingDays,
          performedBy: session.id,
        },
      }),
      markLeaveApprovalNotificationsRead(id),
    ]);

    return Response.json(apiSuccess({ id }, "Leave request approved"));
  } catch {
    return apiError("Server error", "Failed to approve leave request", 500);
  }
}
