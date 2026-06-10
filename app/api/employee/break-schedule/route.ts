import { NextRequest } from "next/server";
import { getEmployeeSession } from "@/lib/employee-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getEmployeeBreakSchedule } from "@/lib/breaks/service";

/** Return today's break schedule for the logged-in employee */
export async function GET(request: NextRequest) {
  try {
    const session = await getEmployeeSession();
    if (!session) {
      return apiError("Unauthorized", "Not authenticated", 401);
    }

    const weekday = request.nextUrl.searchParams.get("weekday");
    const schedule = await getEmployeeBreakSchedule(session.employeeId, weekday);

    if (!schedule) {
      return apiError("Not found", "Break schedule unavailable", 404);
    }

    return Response.json(apiSuccess(schedule));
  } catch {
    return apiError("Server error", "Failed to load break schedule", 500);
  }
}
