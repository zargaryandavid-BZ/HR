import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getEmployeeSession } from "@/lib/employee-session";
import { logLeaveAudit, markLeaveApprovalNotificationsRead } from "@/lib/leave/service";

type RouteParams = { params: Promise<{ requestId: string }> };

/** Cancel a pending leave request owned by the authenticated employee */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const { requestId } = await params;

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: requestId },
    });

    if (!leaveRequest) {
      return apiError("Not found", "Leave request not found", 404);
    }

    if (leaveRequest.employeeId !== session.employeeId) {
      return apiError("Forbidden", "You can only cancel your own leave requests", 403);
    }

    if (leaveRequest.status !== "PENDING") {
      return apiError("Invalid status", "Only pending requests can be cancelled", 400);
    }

    const year = leaveRequest.startDate.getFullYear();

    await prisma.$transaction([
      prisma.leaveRequest.update({
        where: { id: requestId },
        data: { status: "CANCELLED" },
      }),
      prisma.leaveBalance.updateMany({
        where: {
          employeeId: leaveRequest.employeeId,
          leaveTypeId: leaveRequest.leaveTypeId,
          year,
        },
        data: { pendingDays: { decrement: leaveRequest.workingDays } },
      }),
    ]);

    const linkedUser = await prisma.user.findFirst({
      where: { employeeId: session.employeeId },
      select: { id: true },
    });

    if (linkedUser) {
      await logLeaveAudit({
        userId: linkedUser.id,
        action: "LEAVE_REQUEST_CANCELLED",
        targetId: requestId,
        newValue: { requestId, employeeId: session.employeeId },
      });
    }

    await markLeaveApprovalNotificationsRead(requestId);

    return Response.json(apiSuccess({ status: "CANCELLED" }));
  } catch {
    return apiError("Server error", "Failed to cancel leave request", 500);
  }
}
