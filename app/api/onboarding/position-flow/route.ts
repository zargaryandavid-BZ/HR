import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

/** Get onboarding flow status for a position (used by employee form) */
export async function GET(request: NextRequest) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);

    const positionId = request.nextUrl.searchParams.get("positionId");
    if (!positionId) {
      return apiError("Validation failed", "positionId is required");
    }

    const template = await prisma.onboardingTemplate.findFirst({
      where: { positionId, isActive: true },
      include: { _count: { select: { steps: true } } },
    });

    return Response.json(
      apiSuccess({
        hasFlow: !!template && template._count.steps > 0,
        template: template
          ? { id: template.id, name: template.name, stepCount: template._count.steps }
          : null,
      })
    );
  } catch {
    return apiError("Unauthorized", "Not authorized", 401);
  }
}
