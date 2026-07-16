import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createInAppNotification } from "@/lib/documents/service";
import { logIndividualSettingsAudit } from "@/lib/individual-settings/audit";
import { prisma } from "@/lib/prisma";
import {
  calculatePointSummary,
  getDefaultPointExpiry,
  mapViolation,
} from "@/lib/points-server";

type RouteParams = { params: Promise<{ employeeId: string }> };

const createViolationSchema = z
  .object({
    points: z.coerce.number().positive().max(100),
    reason: z.string().trim().min(1).max(1_000),
    violationType: z.string().trim().max(100).optional().nullable(),
    incidentDate: z.coerce.date(),
    expiresAt: z.coerce.date().optional(),
  })
  .refine(
    (value) => !value.expiresAt || value.expiresAt > value.incidentDate,
    { message: "Expiry date must be after the incident date", path: ["expiresAt"] }
  );

function isPointsAdmin(role: string) {
  return role === "HR_ADMIN" || role === "SUPER_ADMIN";
}

/** Return one employee's active and historical point violations. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!isPointsAdmin(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { employeeId } = await params;
    const now = new Date();
    await prisma.pointViolation.updateMany({
      where: { employeeId, expiresAt: { lte: now }, isExpired: false },
      data: { isExpired: true },
    });

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        workEmail: true,
        department: { select: { name: true } },
        position: { select: { name: true } },
        jobTitle: true,
        pointViolations: {
          include: {
            addedBy: { select: { name: true, email: true } },
            editedBy: { select: { name: true, email: true } },
          },
          orderBy: [{ isExpired: "asc" }, { incidentDate: "desc" }],
        },
      },
    });
    if (!employee) return apiError("Not found", "Employee not found", 404);

    const summary = calculatePointSummary(employee.pointViolations, now);
    return Response.json(
      apiSuccess({
        employee: {
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          preferredName: employee.preferredName,
          workEmail: employee.workEmail,
          department: employee.department?.name ?? null,
          position: employee.position?.name ?? employee.jobTitle ?? null,
        },
        summary: {
          totalActivePoints: summary.totalActivePoints,
          tier: summary.tier.tier,
          nextExpiry: summary.nextExpiry?.toISOString() ?? null,
        },
        violations: employee.pointViolations.map((violation) => ({
          ...mapViolation(violation),
          addedBy: violation.addedBy.name ?? violation.addedBy.email,
          editedBy: violation.editedBy
            ? violation.editedBy.name ?? violation.editedBy.email
            : null,
          editedAt: violation.editedAt?.toISOString() ?? null,
        })),
      })
    );
  } catch {
    return apiError("Server error", "Failed to fetch employee points", 500);
  }
}

/** Add a point violation for an employee. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!isPointsAdmin(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { employeeId } = await params;
    const parsed = createViolationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message);
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) return apiError("Not found", "Employee not found", 404);

    const expiresAt =
      parsed.data.expiresAt ?? getDefaultPointExpiry(parsed.data.incidentDate);
    const violation = await prisma.pointViolation.create({
      data: {
        employeeId,
        points: parsed.data.points,
        reason: parsed.data.reason,
        violationType: parsed.data.violationType || null,
        incidentDate: parsed.data.incidentDate,
        expiresAt,
        addedById: session.id,
      },
    });

    await Promise.all([
      createInAppNotification({
        employeeId,
        eventType: "POINT_VIOLATION_CREATED",
        message: `${violation.points} point${violation.points === 1 ? "" : "s"} have been added to your record.`,
        metadata: { violationId: violation.id, href: "/employee/dashboard" },
      }),
      logIndividualSettingsAudit({
        userId: session.id,
        action: "POINT_VIOLATION_CREATED",
        targetId: employeeId,
        targetTable: "PointViolation",
        newValue: {
          violationId: violation.id,
          points: violation.points,
          incidentDate: violation.incidentDate.toISOString(),
          expiresAt: violation.expiresAt.toISOString(),
        },
      }),
    ]);

    return Response.json(apiSuccess(mapViolation(violation), "Points added"), {
      status: 201,
    });
  } catch {
    return apiError("Server error", "Failed to add points", 500);
  }
}
