import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { offboardingTemplateSchema } from "@/lib/validations";

type RouteParams = { params: Promise<{ positionId: string }> };

/** Get or upsert the offboarding flow for a position */
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

    const template = await prisma.offboardingTemplate.findFirst({
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

/** Manually create an empty offboarding automation for a position */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { positionId } = await params;

    const position = await prisma.position.findUnique({ where: { id: positionId } });
    if (!position) {
      return apiError("Not found", "Position not found", 404);
    }

    const existing = await prisma.offboardingTemplate.findFirst({
      where: { positionId, isActive: true },
    });

    if (existing) {
      return apiError("Conflict", "An automation already exists for this position", 409);
    }

    const template = await prisma.offboardingTemplate.create({
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

/** Create or update offboarding flow metadata for a position */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { positionId } = await params;
    const body = await request.json();
    const parsed = offboardingTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const position = await prisma.position.findUnique({ where: { id: positionId } });
    if (!position) {
      return apiError("Not found", "Position not found", 404);
    }

    const existing = await prisma.offboardingTemplate.findFirst({
      where: { positionId },
      orderBy: { updatedAt: "desc" },
    });

    const template = await prisma.$transaction(async (tx) => {
      if (parsed.data.isActive) {
        await tx.offboardingTemplate.updateMany({
          where: { positionId, isActive: true },
          data: { isActive: false },
        });
      }

      if (existing) {
        return tx.offboardingTemplate.update({
          where: { id: existing.id },
          data: parsed.data,
          include: { steps: { orderBy: { sortOrder: "asc" } } },
        });
      }

      return tx.offboardingTemplate.create({
        data: {
          ...parsed.data,
          positionId,
          createdById: session.id,
        },
        include: { steps: { orderBy: { sortOrder: "asc" } } },
      });
    });

    return Response.json(apiSuccess(template, "Offboarding flow saved"));
  } catch {
    return apiError("Server error", "Failed to save offboarding flow", 500);
  }
}

/** Delete the offboarding flow for a position (blocked if instances exist) */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { positionId } = await params;

    const template = await prisma.offboardingTemplate.findFirst({
      where: { positionId, isActive: true },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { instances: true } } },
    });

    if (!template) {
      return apiError("Not found", "No offboarding flow to delete", 404);
    }

    if (template._count.instances > 0) {
      return apiError(
        "Cannot delete",
        "This flow has active offboarding instances. Complete or remove them before deleting.",
        400
      );
    }

    await prisma.offboardingTemplate.delete({ where: { id: template.id } });

    return Response.json(apiSuccess(null, "Offboarding flow deleted"));
  } catch {
    return apiError("Server error", "Failed to delete offboarding flow", 500);
  }
}
