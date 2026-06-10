import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { z } from "zod";

type RouteParams = { params: Promise<{ positionId: string }> };

const duplicateSchema = z.object({
  targetPositionId: z.string().min(1, "Target position is required"),
});

/** Copy an offboarding automation and its steps to another position */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { positionId: sourcePositionId } = await params;
    const body = await request.json();
    const parsed = duplicateSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const { targetPositionId } = parsed.data;

    if (sourcePositionId === targetPositionId) {
      return apiError("Validation failed", "Choose a different position to duplicate to", 400);
    }

    const sourceTemplate = await prisma.offboardingTemplate.findFirst({
      where: { positionId: sourcePositionId, isActive: true },
      include: { steps: { orderBy: { sortOrder: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });

    if (!sourceTemplate) {
      return apiError("Not found", "Source automation not found", 404);
    }

    const targetPosition = await prisma.position.findUnique({
      where: { id: targetPositionId },
    });

    if (!targetPosition) {
      return apiError("Not found", "Target position not found", 404);
    }

    const targetExisting = await prisma.offboardingTemplate.findFirst({
      where: { positionId: targetPositionId, isActive: true },
    });

    if (targetExisting) {
      return apiError("Conflict", "Target position already has an automation", 409);
    }

    const template = await prisma.$transaction(async (tx) => {
      const created = await tx.offboardingTemplate.create({
        data: {
          name: targetPosition.name,
          description: sourceTemplate.description,
          positionId: targetPositionId,
          createdById: session.id,
          isActive: true,
        },
      });

      if (sourceTemplate.steps.length > 0) {
        await tx.offboardingStep.createMany({
          data: sourceTemplate.steps.map((step) => ({
            templateId: created.id,
            title: step.title,
            description: step.description,
            stepType: step.stepType,
            sortOrder: step.sortOrder,
            isRequired: step.isRequired,
            config: step.config as Prisma.InputJsonValue,
          })),
        });
      }

      return tx.offboardingTemplate.findUnique({
        where: { id: created.id },
        include: {
          steps: { orderBy: { sortOrder: "asc" } },
          position: { include: { department: { select: { id: true, name: true } } } },
          _count: { select: { steps: true } },
        },
      });
    });

    return Response.json(apiSuccess(template, "Automation duplicated"), { status: 201 });
  } catch {
    return apiError("Server error", "Failed to duplicate automation", 500);
  }
}
