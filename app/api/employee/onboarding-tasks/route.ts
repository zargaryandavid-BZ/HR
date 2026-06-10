import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getEmployeeSession } from "@/lib/employee-session";
import { getOnboardingTasksForEmployee } from "@/lib/onboarding/tasks";

/** Return the authenticated employee's onboarding task progress */
export async function GET() {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const data = await getOnboardingTasksForEmployee(session.employeeId, {
      excludeDocumentSign: true,
    });

    return Response.json(apiSuccess(data));
  } catch {
    return apiError("Server error", "Failed to fetch onboarding tasks", 500);
  }
}
