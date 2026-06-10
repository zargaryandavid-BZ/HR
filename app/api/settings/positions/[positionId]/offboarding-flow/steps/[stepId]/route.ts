import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { offboardingStepSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";

type RouteParams = { params: Promise<{ positionId: string; stepId: string }> };

/** Update an onboarding step */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { positionId, stepId } = await params;
    const body = await request.json();
    const parsed = offboardingStepSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const template = await prisma.offboardingTemplate.findFirst({
      where: { positionId },
      orderBy: { updatedAt: "desc" },
    });

    if (!template) {
      return apiError("Not found", "Offboarding flow not found", 404);
    }

    const step = await prisma.offboardingStep.updateMany({
      where: { id: stepId, templateId: template.id },
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        stepType: parsed.data.stepType,
        isRequired: parsed.data.isRequired,
        config: parsed.data.config as Prisma.InputJsonValue,
      },
    });

    if (step.count === 0) {
      return apiError("Not found", "Step not found", 404);
    }

    const updated = await prisma.offboardingStep.findUnique({ where: { id: stepId } });
    return Response.json(apiSuccess(updated, "Step updated"));
  } catch {
    return apiError("Server error", "Failed to update step", 500);
  }
}

/** Delete an onboarding step and reindex remaining steps */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { positionId, stepId } = await params;

    const template = await prisma.offboardingTemplate.findFirst({
      where: { positionId },
      orderBy: { updatedAt: "desc" },
    });

    if (!template) {
      return apiError("Not found", "Offboarding flow not found", 404);
    }

    const step = await prisma.offboardingStep.findFirst({
      where: { id: stepId, templateId: template.id },
    });

    if (!step) {
      return apiError("Not found", "Step not found", 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.offboardingStepProgress.deleteMany({ where: { stepId } });
      await tx.offboardingStep.delete({ where: { id: stepId } });

      const remaining = await tx.offboardingStep.findMany({
        where: { templateId: template.id },
        orderBy: { sortOrder: "asc" },
      });

      await Promise.all(
        remaining.map((remainingStep, index) =>
          tx.offboardingStep.update({
            where: { id: remainingStep.id },
            data: { sortOrder: index },
          })
        )
      );
    });

    return Response.json(apiSuccess(null, "Step deleted"));
  } catch {
    return apiError("Server error", "Failed to delete step", 500);
  }
}
