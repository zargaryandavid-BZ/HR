import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseFormDate } from "@/lib/dates";
import { canViewEmployeeSettings } from "@/lib/individual-settings/auth";

const patchSchema = z.object({
  lastDayDate: z.string().nullable().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

/** Get the active offboarding instance for an employee */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const { id: employeeId } = await params;
    if (!canViewEmployeeSettings(session, employeeId)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const instance = await prisma.offboardingInstance.findFirst({
      where: { employeeId, status: "IN_PROGRESS" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        lastDayDate: true,
        initiatedAt: true,
        completedAt: true,
      },
    });

    return Response.json(apiSuccess(instance));
  } catch {
    return apiError("Server error", "Failed to fetch offboarding instance", 500);
  }
}

/** Update offboarding instance fields (e.g. last day date) */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id: employeeId } = await params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const instance = await prisma.offboardingInstance.findFirst({
      where: { employeeId, status: "IN_PROGRESS" },
      orderBy: { createdAt: "desc" },
    });

    if (!instance) {
      return apiError("Not found", "No active offboarding instance", 404);
    }

    const updated = await prisma.offboardingInstance.update({
      where: { id: instance.id },
      data: {
        ...(parsed.data.lastDayDate !== undefined && {
          lastDayDate: parsed.data.lastDayDate
            ? parseFormDate(parsed.data.lastDayDate)
            : null,
        }),
      },
      select: {
        id: true,
        lastDayDate: true,
        status: true,
      },
    });

    return Response.json(apiSuccess(updated, "Offboarding updated"));
  } catch {
    return apiError("Server error", "Failed to update offboarding", 500);
  }
}
