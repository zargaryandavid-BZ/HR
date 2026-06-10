import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getEmployeeBreakSchedule } from "@/lib/breaks/service";

type RouteParams = { params: Promise<{ id: string }> };

/** Return break entitlement for an employee on a given weekday */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN", "MANAGER"]);
    const { id } = await params;
    const weekday = request.nextUrl.searchParams.get("weekday");

    const schedule = await getEmployeeBreakSchedule(id, weekday);
    if (!schedule) {
      return apiError("Not found", "Employee not found", 404);
    }

    return Response.json(apiSuccess(schedule));
  } catch {
    return apiError("Unauthorized", "Not authorized", 401);
  }
}
