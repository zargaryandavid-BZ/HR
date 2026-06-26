import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getEmployeeSession } from "@/lib/employee-session";
import { parseFormDate, toDateOnlyString } from "@/lib/dates";
import { validateAccruedLeaveEligibility } from "@/lib/accrual/leave-validation";
import { notifyLeaveRequestSubmitted } from "@/lib/leave/service";
import { resolveLeaveRequestDuration } from "@/lib/leave/resolve-request-duration";
import { validateLeaveBalanceForRequest } from "@/lib/leave/balance-validation";
import { HOURS_PER_WORK_DAY } from "@/lib/accrual/constants";

const schema = z.object({
  leaveTypeId: z.string().min(1),
  startDate: z.string(),
  endDate: z.string().optional(),
  notes: z.string().optional(),
  requestMode: z.enum(["days", "hours"]).optional(),
  durationHours: z.coerce.number().positive().max(HOURS_PER_WORK_DAY).optional(),
});

/** Submit a leave request on behalf of the authenticated employee */
export async function POST(request: NextRequest) {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError("Validation failed", parsed.error.errors[0]?.message);

    const { leaveTypeId, startDate, endDate, notes, requestMode, durationHours } = parsed.data;
    const mode = requestMode ?? (durationHours != null ? "hours" : "days");
    const resolvedEndDate = mode === "hours" ? (endDate ?? startDate) : endDate;
    if (!resolvedEndDate) {
      return apiError("Validation failed", "End date is required");
    }

    const today = parseFormDate(toDateOnlyString(new Date()));
    const start = parseFormDate(startDate);
    if (start < today) {
      return apiError("Validation failed", "Start date cannot be in the past");
    }

    const leaveType = await prisma.leaveType.findUnique({
      where: { id: leaveTypeId },
      select: { id: true, name: true, slug: true, isActive: true, isPaid: true, defaultDays: true },
    });
    if (!leaveType || !leaveType.isActive) {
      return apiError("Not found", "Leave type not found", 404);
    }

    const eligibility = await validateAccruedLeaveEligibility(
      session.employeeId,
      leaveType.slug
    );
    if (!eligibility.ok) {
      return apiError("Validation failed", eligibility.message);
    }

    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: parseFormDate(startDate),
          lte: parseFormDate(resolvedEndDate),
        },
        OR: [{ isCompanyWide: true }, { employeeId: session.employeeId }],
      },
      select: { date: true },
    });

    const duration = resolveLeaveRequestDuration(
      { startDate, endDate: resolvedEndDate, requestMode: mode, durationHours },
      holidays.map((h) => h.date)
    );
    if ("error" in duration) {
      return apiError("Validation failed", duration.error);
    }

    const year = duration.start.getFullYear();

    const leaveRequest = await prisma.$transaction(async (tx) => {
      const balance = await tx.leaveBalance.upsert({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: session.employeeId,
            leaveTypeId,
            year,
          },
        },
        create: {
          employeeId: session.employeeId,
          leaveTypeId,
          year,
          allowance: leaveType.isPaid ? leaveType.defaultDays : 0,
          usedDays: 0,
          pendingDays: 0,
        },
        update: {},
      });

      if (leaveType.isPaid) {
        const balanceCheck = validateLeaveBalanceForRequest(leaveType, balance, duration);
        if (!balanceCheck.ok) {
          throw new Error(balanceCheck.message);
        }
      }

      const req = await tx.leaveRequest.create({
        data: {
          employeeId: session.employeeId,
          leaveTypeId,
          startDate: duration.start,
          endDate: duration.end,
          workingDays: duration.workingDays,
          workingHours: duration.workingHours,
          status: "PENDING",
          notes: notes ?? null,
        },
      });

      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: { pendingDays: { increment: duration.workingDays } },
      });

      return req;
    });

    await notifyLeaveRequestSubmitted({
      leaveRequestId: leaveRequest.id,
      employeeId: session.employeeId,
      leaveTypeName: leaveType.name,
      startDate: duration.start,
      endDate: duration.end,
    });

    return Response.json(
      apiSuccess(
        {
          id: leaveRequest.id,
          policyId: leaveTypeId,
          leaveType: leaveType.name,
          startDate: toDateOnlyString(duration.start),
          endDate: toDateOnlyString(duration.end),
          days: duration.workingDays,
          hours: duration.workingHours,
          status: "PENDING" as const,
          notes: notes ?? null,
          rejectionReason: null,
          createdAt: leaveRequest.createdAt.toISOString(),
          submittedAt: leaveRequest.submittedAt.toISOString(),
        },
        "Leave request submitted"
      )
    );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Insufficient balance")) {
      return apiError("Validation failed", error.message);
    }
    return apiError("Server error", "Failed to submit leave request", 500);
  }
}
