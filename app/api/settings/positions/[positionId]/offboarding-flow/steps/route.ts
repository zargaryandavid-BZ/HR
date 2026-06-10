import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { offboardingStepSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";

type RouteParams = { params: Promise<{ positionId: string }> };

/** Add a step to the position offboarding flow */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { positionId } = await params;
    const body = await request.json();
    const parsed = offboardingStepSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const template = await prisma.offboardingTemplate.findFirst({
      where: { positionId, isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    if (!template) {
      return apiError(
        "Not found",
        "No automation exists for this position. Create one from Offboarding Automation first.",
        404
      );
    }

    const maxOrder = await prisma.offboardingStep.aggregate({
      where: { templateId: template.id },
      _max: { sortOrder: true },
    });

    const step = await prisma.offboardingStep.create({
      data: {
        templateId: template.id,
        title: parsed.data.title,
        description: parsed.data.description,
        stepType: parsed.data.stepType,
        isRequired: parsed.data.isRequired,
        config: parsed.data.config as Prisma.InputJsonValue,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    return Response.json(apiSuccess(step, "Step added"), { status: 201 });
  } catch {
    return apiError("Server error", "Failed to add step", 500);
  }
}

/** Reorder steps in the offboarding flow */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { positionId } = await params;
    const body = await request.json();
    const stepIds = body.stepIds as string[] | undefined;

    if (!Array.isArray(stepIds) || stepIds.length === 0) {
      return apiError("Validation failed", "stepIds array is required");
    }

    const template = await prisma.offboardingTemplate.findFirst({
      where: { positionId },
      orderBy: { updatedAt: "desc" },
    });

    if (!template) {
      return apiError("Not found", "Offboarding flow not found", 404);
    }

    await prisma.$transaction(
      stepIds.map((stepId, index) =>
        prisma.offboardingStep.updateMany({
          where: { id: stepId, templateId: template.id },
          data: { sortOrder: index },
        })
      )
    );

    const steps = await prisma.offboardingStep.findMany({
      where: { templateId: template.id },
      orderBy: { sortOrder: "asc" },
    });

    return Response.json(apiSuccess(steps, "Steps reordered"));
  } catch {
    return apiError("Server error", "Failed to reorder steps", 500);
  }
}
