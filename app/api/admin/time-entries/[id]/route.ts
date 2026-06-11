import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";

const schema = z.object({
  clockIn: z.string().datetime().optional(),
  clockOut: z.string().datetime().optional(),
  reason: z.string().min(1, "Reason is required"),
  notes: z.string().optional(),
  status: z.enum(["APPROVED", "FLAGGED", "COMPLETED"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { id } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");

    const existing = await prisma.timeEntry.findUnique({ where: { id } });
    if (!existing) return apiError("Not found", "Time entry not found", 404);

    const clockIn = parsed.data.clockIn ? new Date(parsed.data.clockIn) : existing.clockIn;
    const clockOut = parsed.data.clockOut
      ? new Date(parsed.data.clockOut)
      : existing.clockOut;

    const hoursWorked =
      clockOut
        ? Math.max(0, (clockOut.getTime() - clockIn.getTime()) / 3_600_000)
        : existing.hoursWorked;

    const updated = await prisma.timeEntry.update({
      where: { id },
      data: {
        ...(parsed.data.clockIn && { clockIn }),
        ...(parsed.data.clockOut && { clockOut }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
        ...(parsed.data.status && { status: parsed.data.status }),
        ...(clockOut && { hoursWorked }),
        ...(parsed.data.status === "APPROVED" && {
          approvedById: user.id,
          approvedAt: new Date(),
        }),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: parsed.data.status === "APPROVED" ? "APPROVE_TIME_ENTRY" : "EDIT_TIME_ENTRY",
        targetId: id,
        targetTable: "TimeEntry",
        oldValue: {
          clockIn: existing.clockIn,
          clockOut: existing.clockOut,
          notes: existing.notes,
          status: existing.status,
        },
        newValue: {
          clockIn: updated.clockIn,
          clockOut: updated.clockOut,
          notes: updated.notes,
          status: updated.status,
        },
        reason: parsed.data.reason,
      },
    });

    return Response.json(apiSuccess(updated, "Time entry updated"));
  } catch {
    return apiError("Server error", "Failed to update time entry", 500);
  }
}
