import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { positionPatchSchema } from "@/lib/validations";

type RouteParams = { params: Promise<{ positionId: string }> };

/** Get a single position with onboarding status */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);

    const { positionId } = await params;

    const position = await prisma.position.findUnique({
      where: { id: positionId },
      include: {
        department: true,
        _count: { select: { employees: true } },
        onboardingTemplates: {
          where: { isActive: true },
          include: { _count: { select: { steps: true } } },
          take: 1,
        },
      },
    });

    if (!position) {
      return apiError("Not found", "Position not found", 404);
    }

    return Response.json(apiSuccess(position));
  } catch {
    return apiError("Unauthorized", "Not authorized", 401);
  }
}

/** Update a position */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);

    const { positionId } = await params;
    const body = await request.json();
    const parsed = positionPatchSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const position = await prisma.position.update({
      where: { id: positionId },
      data: parsed.data,
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
        onboardingTemplates: {
          where: { isActive: true },
          select: { id: true },
          take: 1,
        },
      },
    });

    return Response.json(apiSuccess(position, "Position updated"));
  } catch {
    return apiError("Server error", "Failed to update position", 500);
  }
}

/** Permanently delete a position when no employees or onboarding history exist */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);

    const { positionId } = await params;

    const position = await prisma.position.findUnique({
      where: { id: positionId },
      include: {
        _count: { select: { employees: true } },
        onboardingTemplates: {
          include: { _count: { select: { instances: true } } },
        },
      },
    });

    if (!position) {
      return apiError("Not found", "Position not found", 404);
    }

    if (position._count.employees > 0) {
      return apiError(
        "Cannot delete",
        `This position has ${position._count.employees} assigned employee(s). Deactivate it instead.`,
        400
      );
    }

    const hasOnboardingHistory = position.onboardingTemplates.some(
      (template) => template._count.instances > 0
    );
    if (hasOnboardingHistory) {
      return apiError(
        "Cannot delete",
        "This position has onboarding history. Deactivate it instead.",
        400
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.documentPositionLink.deleteMany({ where: { positionId } });
      for (const template of position.onboardingTemplates) {
        await tx.onboardingTemplate.delete({ where: { id: template.id } });
      }
      await tx.position.delete({ where: { id: positionId } });
    });

    return Response.json(apiSuccess(null, "Position deleted"));
  } catch {
    return apiError("Server error", "Failed to delete position", 500);
  }
}
