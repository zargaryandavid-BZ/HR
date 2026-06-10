import { apiSuccess, apiError } from "@/lib/api-response";
import { getEmployeeSession } from "@/lib/employee-session";
import { getImportantDates } from "@/lib/leave/important-dates";

/** Returns upcoming important dates for the authenticated employee */
export async function GET() {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const dates = await getImportantDates(session.employeeId);
    return Response.json(apiSuccess(dates));
  } catch {
    return apiError("Server error", "Failed to fetch important dates", 500);
  }
}
