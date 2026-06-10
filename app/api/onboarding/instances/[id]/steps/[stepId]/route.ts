import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { completeOnboardingStep } from "@/lib/onboarding/service";

type RouteParams = { params: Promise<{ id: string; stepId: string }> };

/** Complete an onboarding step (employee wizard) */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session?.employeeId) {
      return apiError("Unauthorized", "Not authenticated", 401);
    }

    const { id, stepId } = await params;
    const body = await request.json();
    const responseData = body.responseData ?? {};

    const instance = await completeOnboardingStep(
      id,
      stepId,
      responseData,
      session.employeeId
    );

    return Response.json(apiSuccess(instance, "Step completed"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to complete step";
    return apiError("Failed", message);
  }
}

/** Mark step as in progress when employee opens it */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session?.employeeId) {
      return apiError("Unauthorized", "Not authenticated", 401);
    }

    const { id, stepId } = await params;

    const { prisma } = await import("@/lib/prisma");

    const instance = await prisma.onboardingInstance.findUnique({
      where: { id },
      include: { stepProgress: true },
    });

    if (!instance || instance.employeeId !== session.employeeId) {
      return apiError("Not found", "Onboarding not found", 404);
    }

    const progress = instance.stepProgress.find((p) => p.stepId === stepId);
    if (!progress || progress.status === "LOCKED" || progress.status === "COMPLETED") {
      return apiError("Invalid", "Step is not available");
    }

    if (progress.status === "AVAILABLE") {
      await prisma.onboardingStepProgress.update({
        where: { id: progress.id },
        data: { status: "IN_PROGRESS" },
      });

      if (instance.status === "NOT_STARTED") {
        await prisma.onboardingInstance.update({
          where: { id },
          data: { status: "IN_PROGRESS", startedAt: new Date() },
        });
      }
    }

    return Response.json(apiSuccess(null));
  } catch {
    return apiError("Server error", "Failed to update step", 500);
  }
}
