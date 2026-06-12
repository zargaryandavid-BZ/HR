import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";

const breakSchema = z.object({
  id: z.string().optional(),
  breakType: z.enum(["REST", "MEAL"]),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable().optional(),
  _delete: z.boolean().optional(),
});

const schema = z.object({
  clockIn: z.string().datetime().optional(),
  clockOut: z.string().datetime().optional(),
  reason: z.string().min(1, "Reason is required"),
  notes: z.string().optional(),
  status: z.enum(["APPROVED", "FLAGGED", "COMPLETED"]).optional(),
  breaks: z.array(breakSchema).optional(),
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

    const existing = await prisma.timeEntry.findUnique({
      where: { id },
      include: { breaks: true },
    });
    if (!existing) return apiError("Not found", "Time entry not found", 404);

    const clockIn = parsed.data.clockIn ? new Date(parsed.data.clockIn) : existing.clockIn;
    const clockOut = parsed.data.clockOut
      ? new Date(parsed.data.clockOut)
      : existing.clockOut;

    // Apply break mutations inside a transaction
    await prisma.$transaction(async (tx) => {
      if (parsed.data.breaks && parsed.data.breaks.length > 0) {
        for (const brk of parsed.data.breaks) {
          if (brk._delete) {
            if (brk.id) {
              await tx.breakEntry.delete({ where: { id: brk.id } });
            }
          } else if (brk.id) {
            const endedAt = brk.endedAt ? new Date(brk.endedAt) : null;
            const durationMin = endedAt
              ? Math.round((endedAt.getTime() - new Date(brk.startedAt).getTime()) / 60_000)
              : null;
            await tx.breakEntry.update({
              where: { id: brk.id },
              data: {
                breakType: brk.breakType,
                startedAt: new Date(brk.startedAt),
                endedAt,
                durationMin,
              },
            });
          } else {
            const endedAt = brk.endedAt ? new Date(brk.endedAt) : null;
            const durationMin = endedAt
              ? Math.round((endedAt.getTime() - new Date(brk.startedAt).getTime()) / 60_000)
              : null;
            await tx.breakEntry.create({
              data: {
                timeEntryId: id,
                breakType: brk.breakType,
                startedAt: new Date(brk.startedAt),
                endedAt,
                durationMin,
              },
            });
          }
        }
      }

      // Recalculate hoursWorked subtracting all completed breaks after mutations
      let hoursWorked = existing.hoursWorked;
      if (clockOut) {
        const updatedBreaks = await tx.breakEntry.findMany({
          where: { timeEntryId: id },
        });
        const totalBreakMin = updatedBreaks
          .filter((b) => b.endedAt != null)
          .reduce((sum, b) => sum + (b.durationMin ?? 0), 0);
        const rawMs = clockOut.getTime() - clockIn.getTime();
        hoursWorked = Math.max(0, (rawMs - totalBreakMin * 60_000) / 3_600_000);
      }

      const updated = await tx.timeEntry.update({
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

      await tx.auditLog.create({
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

      return updated;
    });

    return Response.json(apiSuccess(null, "Time entry updated"));
  } catch {
    return apiError("Server error", "Failed to update time entry", 500);
  }
}
