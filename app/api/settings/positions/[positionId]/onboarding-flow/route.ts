import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { onboardingTemplateSchema } from "@/lib/validations";

type RouteParams = { params: Promise<{ positionId: string }> };

/** Get or upsert the onboarding flow for a position */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);

    const { positionId } = await params;

    const position = await prisma.position.findUnique({
      where: { id: positionId },
      include: { department: true },
    });

    if (!position) {
      return apiError("Not found", "Position not found", 404);
    }

    const template = await prisma.onboardingTemplate.findFirst({
      where: { positionId },
      include: {
        steps: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return Response.json(apiSuccess({ position, template }));
  } catch {
    return apiError("Unauthorized", "Not authorized", 401);
  }
}

/** Manually create an empty onboarding automation for a position */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { positionId } = await params;

    const position = await prisma.position.findUnique({ where: { id: positionId } });
    if (!position) {
      return apiError("Not found", "Position not found", 404);
    }

    const existing = await prisma.onboardingTemplate.findFirst({
      where: { positionId, isActive: true },
    });

    if (existing) {
      return apiError("Conflict", "An automation already exists for this position", 409);
    }

    const template = await prisma.onboardingTemplate.create({
      data: {
        name: position.name,
        positionId,
        createdById: session.id,
        isActive: true,
      },
      include: { steps: { orderBy: { sortOrder: "asc" } } },
    });

    return Response.json(apiSuccess(template, "Automation created"), { status: 201 });
  } catch {
    return apiError("Server error", "Failed to create automation", 500);
  }
}

/** Create or update onboarding flow metadata for a position */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { positionId } = await params;
    const body = await request.json();
    const parsed = onboardingTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const position = await prisma.position.findUnique({ where: { id: positionId } });
    if (!position) {
      return apiError("Not found", "Position not found", 404);
    }

    const existing = await prisma.onboardingTemplate.findFirst({
      where: { positionId },
      orderBy: { updatedAt: "desc" },
    });

    const template = await prisma.$transaction(async (tx) => {
      if (parsed.data.isActive) {
        await tx.onboardingTemplate.updateMany({
          where: { positionId, isActive: true },
          data: { isActive: false },
        });
      }

      if (existing) {
        return tx.onboardingTemplate.update({
          where: { id: existing.id },
          data: parsed.data,
          include: { steps: { orderBy: { sortOrder: "asc" } } },
        });
      }

      return tx.onboardingTemplate.create({
        data: {
          ...parsed.data,
          positionId,
          createdById: session.id,
        },
        include: { steps: { orderBy: { sortOrder: "asc" } } },
      });
    });

    return Response.json(apiSuccess(template, "Onboarding flow saved"));
  } catch {
    return apiError("Server error", "Failed to save onboarding flow", 500);
  }
}

/** Delete the onboarding flow for a position (blocked if instances exist) */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { positionId } = await params;

    const template = await prisma.onboardingTemplate.findFirst({
      where: { positionId, isActive: true },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { instances: true } } },
    });

    if (!template) {
      return apiError("Not found", "No onboarding flow to delete", 404);
    }

    if (template._count.instances > 0) {
      return apiError(
        "Cannot delete",
        "This flow has active onboarding instances. Complete or remove them before deleting.",
        400
      );
    }

    await prisma.onboardingTemplate.delete({ where: { id: template.id } });

    return Response.json(apiSuccess(null, "Onboarding flow deleted"));
  } catch {
    return apiError("Server error", "Failed to delete onboarding flow", 500);
  }
}
