import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getEmployeeSession } from "@/lib/employee-session";
import { parseFormDate, toDateOnlyString } from "@/lib/dates";
import { calculateWorkingDays } from "@/lib/leave/working-days";
import { validateAccruedLeaveEligibility, getRemainingAccruedHours } from "@/lib/accrual/leave-validation";
import { HOURS_PER_WORK_DAY } from "@/lib/accrual/constants";
import { formatLeaveBalanceValue } from "@/lib/utils";
import { notifyLeaveRequestSubmitted } from "@/lib/leave/service";

const schema = z.object({
  leaveTypeId: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  notes: z.string().optional(),
});

/** Submit a leave request on behalf of the authenticated employee */
export async function POST(request: NextRequest) {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError("Validation failed", parsed.error.errors[0]?.message);

    const { leaveTypeId, startDate, endDate, notes } = parsed.data;
    const start = parseFormDate(startDate);
    const end = parseFormDate(endDate);

    const today = parseFormDate(toDateOnlyString(new Date()));

    if (start < today) {
      return apiError("Validation failed", "Start date cannot be in the past");
    }

    if (end < start) return apiError("Validation failed", "End date must be on or after start date");

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
        date: { gte: start, lte: end },
        OR: [{ isCompanyWide: true }, { employeeId: session.employeeId }],
      },
      select: { date: true },
    });

    const workingDays = calculateWorkingDays(start, end, holidays.map((h) => h.date));

    if (workingDays === 0) {
      return apiError("Validation failed", "No working days in selected range");
    }

    const year = start.getFullYear();

    const leaveRequest = await prisma.$transaction(async (tx) => {
      if (leaveType.isPaid) {
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
            allowance: leaveType.defaultDays,
            usedDays: 0,
            pendingDays: 0,
          },
          update: {},
        });

        if (leaveType.slug === "pto" || leaveType.slug === "sick") {
          const remainingHours = getRemainingAccruedHours(balance);
          const requestedHours = workingDays * HOURS_PER_WORK_DAY;
          if (requestedHours > remainingHours) {
            throw new Error(
              `Insufficient balance. You have ${formatLeaveBalanceValue(remainingHours / HOURS_PER_WORK_DAY)} days available.`
            );
          }
        }

        const req = await tx.leaveRequest.create({
          data: {
            employeeId: session.employeeId,
            leaveTypeId,
            startDate: start,
            endDate: end,
            workingDays,
            status: "PENDING",
            notes: notes ?? null,
          },
        });

        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { pendingDays: { increment: workingDays } },
        });

        return req;
      }

      // Unpaid leave — no balance cap; track usage via pendingDays
      const req = await tx.leaveRequest.create({
        data: {
          employeeId: session.employeeId,
          leaveTypeId,
          startDate: start,
          endDate: end,
          workingDays,
          status: "PENDING",
          notes: notes ?? null,
        },
      });

      await tx.leaveBalance.upsert({
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
          allowance: 0,
          pendingDays: workingDays,
        },
        update: { pendingDays: { increment: workingDays } },
      });

      return req;
    });

    await notifyLeaveRequestSubmitted({
      leaveRequestId: leaveRequest.id,
      employeeId: session.employeeId,
      leaveTypeName: leaveType.name,
      startDate: start,
      endDate: end,
    });

    return Response.json(
      apiSuccess(
        {
          id: leaveRequest.id,
          policyId: leaveTypeId,
          leaveType: leaveType.name,
          startDate: toDateOnlyString(start),
          endDate: toDateOnlyString(end),
          days: workingDays,
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
