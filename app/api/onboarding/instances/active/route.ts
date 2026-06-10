import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

/** Get the current employee's active onboarding instance for nav visibility */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.employeeId) {
      return apiError("Unauthorized", "Not authenticated", 401);
    }

    const instance = await prisma.onboardingInstance.findFirst({
      where: {
        employeeId: session.employeeId,
        status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
      },
      select: { id: true, status: true },
    });

    return Response.json(apiSuccess(instance));
  } catch {
    return apiError("Server error", "Failed to fetch active onboarding", 500);
  }
}
