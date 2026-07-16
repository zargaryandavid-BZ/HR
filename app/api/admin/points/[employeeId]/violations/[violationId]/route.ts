import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { logIndividualSettingsAudit } from "@/lib/individual-settings/audit";
import { prisma } from "@/lib/prisma";
import { getDefaultPointExpiry, mapViolation } from "@/lib/points-server";

type RouteParams = {
  params: Promise<{ employeeId: string; violationId: string }>;
};

const updateViolationSchema = z
  .object({
    points: z.coerce.number().positive().max(100).optional(),
    reason: z.string().trim().min(1).max(1_000).optional(),
    violationType: z.string().trim().max(100).nullable().optional(),
    incidentDate: z.coerce.date().optional(),
    expiresAt: z.coerce.date().optional(),
    isExpired: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  });

function isPointsAdmin(role: string) {
  return role === "HR_ADMIN" || role === "SUPER_ADMIN";
}

/** Edit an existing point violation. */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!isPointsAdmin(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { employeeId, violationId } = await params;
    const parsed = updateViolationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message);
    }

    const violation = await prisma.pointViolation.findFirst({
      where: { id: violationId, employeeId },
    });
    if (!violation) return apiError("Not found", "Point violation not found", 404);

    const incidentDate = parsed.data.incidentDate ?? violation.incidentDate;
    const expiresAt =
      parsed.data.expiresAt ??
      (parsed.data.incidentDate
        ? getDefaultPointExpiry(parsed.data.incidentDate)
        : violation.expiresAt);
    if (expiresAt <= incidentDate) {
      return apiError(
        "Validation failed",
        "Expiry date must be after the incident date"
      );
    }

    const updated = await prisma.pointViolation.update({
      where: { id: violationId },
      data: {
        ...(parsed.data.points !== undefined ? { points: parsed.data.points } : {}),
        ...(parsed.data.reason !== undefined ? { reason: parsed.data.reason } : {}),
        ...(parsed.data.violationType !== undefined
          ? { violationType: parsed.data.violationType || null }
          : {}),
        ...(parsed.data.incidentDate !== undefined ? { incidentDate } : {}),
        ...(parsed.data.expiresAt !== undefined || parsed.data.incidentDate !== undefined
          ? { expiresAt }
          : {}),
        ...(parsed.data.isExpired !== undefined
          ? { isExpired: parsed.data.isExpired }
          : {}),
        editedAt: new Date(),
        editedById: session.id,
      },
    });

    await logIndividualSettingsAudit({
      userId: session.id,
      action: "POINT_VIOLATION_UPDATED",
      targetId: employeeId,
      targetTable: "PointViolation",
      oldValue: {
        points: violation.points,
        reason: violation.reason,
        incidentDate: violation.incidentDate.toISOString(),
        expiresAt: violation.expiresAt.toISOString(),
        isExpired: violation.isExpired,
      },
      newValue: {
        violationId,
        points: updated.points,
        reason: updated.reason,
        incidentDate: updated.incidentDate.toISOString(),
        expiresAt: updated.expiresAt.toISOString(),
        isExpired: updated.isExpired,
      },
    });

    return Response.json(apiSuccess(mapViolation(updated), "Points updated"));
  } catch {
    return apiError("Server error", "Failed to update points", 500);
  }
}

/** Remove a point violation. */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!isPointsAdmin(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { employeeId, violationId } = await params;
    const violation = await prisma.pointViolation.findFirst({
      where: { id: violationId, employeeId },
    });
    if (!violation) return apiError("Not found", "Point violation not found", 404);

    await prisma.pointViolation.delete({ where: { id: violationId } });
    await logIndividualSettingsAudit({
      userId: session.id,
      action: "POINT_VIOLATION_DELETED",
      targetId: employeeId,
      targetTable: "PointViolation",
      oldValue: {
        violationId,
        points: violation.points,
        reason: violation.reason,
      },
    });

    return Response.json(apiSuccess(null, "Point violation deleted"));
  } catch {
    return apiError("Server error", "Failed to delete points", 500);
  }
}
