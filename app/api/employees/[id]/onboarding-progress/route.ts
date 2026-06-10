import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getSession } from "@/lib/auth";
import { getOnboardingTasksForEmployee } from "@/lib/onboarding/tasks";

type RouteParams = { params: Promise<{ id: string }> };

/** Return onboarding step progress for an employee (HR Admin view) */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return apiError("Unauthorized", "Not authenticated", 401);
    }
    if (!["HR_ADMIN", "SUPER_ADMIN", "MANAGER"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id: employeeId } = await params;

    const data = await getOnboardingTasksForEmployee(employeeId, {
      excludeDocumentSign: false,
    });

    return Response.json(apiSuccess(data));
  } catch {
    return apiError("Server error", "Failed to fetch onboarding progress", 500);
  }
}
