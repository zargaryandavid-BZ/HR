import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";
import { logLeaveAudit } from "@/lib/leave/service";
import { z } from "zod";

const schema = z.object({
  leaveTypeId: z.string(),
  allowance: z.number().min(0),
  usedDays: z.number().min(0),
  year: z.number().optional(),
});

/** Adjust a specific employee's leave balance (SUPER_ADMIN only) */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const { employeeId } = await params;
    const session = await requireRole(["SUPER_ADMIN"]);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError("Validation error", parsed.error.errors[0]?.message, 400);

    const { leaveTypeId, allowance, usedDays, year = new Date().getFullYear() } = parsed.data;

    const existing = await prisma.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
    });

    const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });

    const balance = await prisma.leaveBalance.upsert({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
      create: { employeeId, leaveTypeId, year, allowance, usedDays, adjustedById: session.id },
      update: { allowance, usedDays, adjustedById: session.id },
    });

    await logLeaveAudit({
      userId: session.id,
      action: "LEAVE_BALANCE_ADJUSTED",
      targetId: balance.id,
      newValue: {
        employeeId,
        leaveTypeId,
        leaveTypeName: leaveType?.name,
        previousAllowance: existing?.allowance ?? null,
        previousUsedDays: existing?.usedDays ?? null,
        newAllowance: allowance,
        newUsedDays: usedDays,
        performedBy: session.id,
      },
    });

    return Response.json(apiSuccess({ id: balance.id }, "Balance updated"));
  } catch {
    return apiError("Server error", "Failed to update leave balance", 500);
  }
}
