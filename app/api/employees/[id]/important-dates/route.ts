import { apiSuccess, apiError } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";
import { getImportantDates } from "@/lib/leave/important-dates";

type RouteParams = { params: Promise<{ id: string }> };

/** Returns important dates for a specific employee (HR Admin portal preview) */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    await requireRole(["SUPER_ADMIN", "HR_ADMIN", "MANAGER"]);
    const { id } = await params;
    const dates = await getImportantDates(id);
    return Response.json(apiSuccess(dates));
  } catch {
    return apiError("Server error", "Failed to fetch important dates", 500);
  }
}
