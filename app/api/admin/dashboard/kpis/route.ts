import { apiSuccess, apiError } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";
import { fetchAdminDashboardKpis } from "@/lib/admin/dashboard-kpis";

/** Returns live KPI counts for the admin dashboard header */
export async function GET() {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const kpis = await fetchAdminDashboardKpis();
    return Response.json(apiSuccess(kpis));
  } catch {
    return apiError("Server error", "Failed to fetch dashboard KPIs", 500);
  }
}
