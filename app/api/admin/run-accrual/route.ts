import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { runAccrualForEmployee } from "@/lib/accrual/run-accrual";

/** Process incremental accrual from approved time entries for one employee */
export async function POST(request: NextRequest) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);

    const employeeId = request.nextUrl.searchParams.get("employeeId");
    if (!employeeId) {
      return apiError("Validation failed", "employeeId query parameter is required");
    }

    const result = await runAccrualForEmployee(employeeId);
    if (!result) {
      return apiError("Not found", "Employee not found or has no accrual policy", 404);
    }

    return Response.json(apiSuccess(result, "Accrual processed"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return apiError("Forbidden", "Not authorized", 403);
    }
    return apiError("Server error", "Failed to run accrual", 500);
  }
}
