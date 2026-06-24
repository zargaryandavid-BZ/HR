import { parseFormDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, getPaginationParams } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";
import { logLeaveAudit, notifyLeaveStatusChange } from "@/lib/leave/service";
import { resolveLeaveRequestDuration } from "@/lib/leave/resolve-request-duration";
import { z } from "zod";

const createSchema = z.object({
  employeeId: z.string(),
  leaveTypeId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  note: z.string().optional(),
  autoApprove: z.boolean().default(true),
  requestMode: z.enum(["days", "hours"]).optional(),
  durationHours: z.coerce.number().positive().max(8).optional(),
});

/** Returns all leave requests with employee + leave type joined, with filtering */
export async function GET(req: Request) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "HR_ADMIN", "MANAGER"]);
    const url = new URL(req.url);
    const { skip, limit } = getPaginationParams(url.searchParams);

    const status = url.searchParams.get("status") ?? undefined;
    const leaveTypeId = url.searchParams.get("leaveTypeId") ?? undefined;
    const departmentId = url.searchParams.get("departmentId") ?? undefined;
    const period = url.searchParams.get("period") ?? undefined;
    const search = url.searchParams.get("search") ?? undefined;

    const now = new Date();
    let dateFilter: { gte?: Date } | undefined;
    if (period === "this_month") {
      dateFilter = { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
    } else if (period === "last_30") {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      dateFilter = { gte: d };
    } else if (period === "this_year") {
      dateFilter = { gte: new Date(now.getFullYear(), 0, 1) };
    }

    const where = {
      ...(status ? { status: status as never } : {}),
      ...(leaveTypeId ? { leaveTypeId } : {}),
      ...(dateFilter ? { createdAt: dateFilter } : {}),
      employee: {
        ...(departmentId ? { departmentId } : {}),
        ...(session.role === "MANAGER" && session.employee?.departmentId
          ? { departmentId: session.employee.departmentId }
          : {}),
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: "insensitive" as const } },
                { lastName: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
    };

    const [requests, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              departmentId: true,
              department: { select: { name: true } },
              jobTitle: true,
              position: { select: { name: true } },
              manager: {
                select: { firstName: true, lastName: true, preferredName: true },
              },
            },
          },
          leaveType: { select: { id: true, name: true } },
          reviewedBy: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    const currentYear = new Date().getFullYear();

    const balances = await prisma.leaveBalance.findMany({
      where: {
        year: currentYear,
        employeeId: { in: [...new Set(requests.map((r) => r.employeeId))] },
      },
    });

    const balanceMap = new Map(
      balances.map((b) => [`${b.employeeId}:${b.leaveTypeId}`, b])
    );

    const data = requests.map((r) => {
      const balance = balanceMap.get(`${r.employeeId}:${r.leaveTypeId}`);
      const totalDays = balance?.allowance ?? 0;
      const usedDays = balance?.usedDays ?? 0;

      return {
        id: r.id,
        employee: {
          id: r.employee.id,
          firstName: r.employee.firstName,
          lastName: r.employee.lastName,
          department: r.employee.department,
          jobTitle: r.employee.jobTitle,
          positionName: r.employee.position?.name ?? r.employee.jobTitle ?? null,
          managerName: r.employee.manager
            ? `${r.employee.manager.preferredName ?? r.employee.manager.firstName} ${r.employee.manager.lastName}`
            : null,
          avatarInitials: `${r.employee.firstName[0]}${r.employee.lastName[0]}`.toUpperCase(),
        },
        policy: { id: r.leaveType.id, name: r.leaveType.name },
        startDate: r.startDate.toISOString().split("T")[0],
        endDate: r.endDate.toISOString().split("T")[0],
        workingDays: r.workingDays,
        workingHours: r.workingHours,
        status: r.status,
        note: r.notes,
        reviewNote: r.reviewComment,
        reviewedBy: r.reviewedBy
          ? { name: r.reviewedBy.name, email: r.reviewedBy.email }
          : null,
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        balance: {
          totalDays,
          usedDays,
          remainingDays: totalDays - usedDays,
        },
      };
    });

    return Response.json(apiSuccess({ requests: data, total, page: skip / limit + 1, limit }));
  } catch {
    return apiError("Server error", "Failed to fetch leave requests", 500);
  }
}

/** HR manually creates a leave request on behalf of an employee */
export async function POST(req: Request) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "HR_ADMIN"]);
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation error", parsed.error.errors[0]?.message, 400);
    }

    const { employeeId, leaveTypeId, startDate, endDate, note, autoApprove, requestMode, durationHours } =
      parsed.data;

    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: parseFormDate(startDate),
          lte: parseFormDate(endDate),
        },
        OR: [{ isCompanyWide: true }, { employeeId }],
      },
    });

    const duration = resolveLeaveRequestDuration(
      { startDate, endDate, requestMode, durationHours },
      holidays.map((h) => h.date)
    );
    if ("error" in duration) {
      return apiError("Validation error", duration.error, 400);
    }

    const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
    if (!leaveType) return apiError("Not found", "Leave type not found", 404);

    const currentYear = duration.start.getFullYear();
    const { workingDays } = duration;

    const request = await prisma.$transaction(async (tx) => {
      const req = await tx.leaveRequest.create({
        data: {
          employeeId,
          leaveTypeId,
          startDate: duration.start,
          endDate: duration.end,
          workingDays: duration.workingDays,
          workingHours: duration.workingHours,
          notes: note,
          status: autoApprove ? "APPROVED" : "PENDING",
          reviewedById: autoApprove ? session.id : undefined,
          reviewedAt: autoApprove ? new Date() : undefined,
          submittedAt: new Date(),
        },
      });

      if (autoApprove) {
        await tx.leaveBalance.upsert({
          where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year: currentYear } },
          create: { employeeId, leaveTypeId, year: currentYear, allowance: leaveType.defaultDays, usedDays: workingDays },
          update: { usedDays: { increment: workingDays } },
        });
      } else {
        await tx.leaveBalance.upsert({
          where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year: currentYear } },
          create: { employeeId, leaveTypeId, year: currentYear, allowance: leaveType.defaultDays, pendingDays: workingDays },
          update: { pendingDays: { increment: workingDays } },
        });
      }

      return req;
    });

    await logLeaveAudit({
      userId: session.id,
      action: "LEAVE_REQUESTED",
      targetId: request.id,
      newValue: { employeeId, leaveTypeId, startDate, endDate, workingDays, autoApprove },
    });

    if (autoApprove) {
      await notifyLeaveStatusChange({
        employeeId,
        leaveTypeName: leaveType.name,
        startDate: duration.start,
        endDate: duration.end,
        status: "APPROVED",
        hrAdded: true,
      });
      await logLeaveAudit({
        userId: session.id,
        action: "LEAVE_APPROVED",
        targetId: request.id,
        newValue: { employeeId, workingDays, performedBy: session.id },
      });
    }

    return Response.json(apiSuccess({ id: request.id }, "Leave request created"), { status: 201 });
  } catch {
    return apiError("Server error", "Failed to create leave request", 500);
  }
}
