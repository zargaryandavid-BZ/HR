import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { backfillAllActiveEmployeeAccrual } from "@/lib/accrual/backfill";

/** One-time backfill of PTO/sick accrual for active employees (SUPER_ADMIN only) */
export async function POST() {
  try {
    await requireRole(["SUPER_ADMIN"]);

    const results = await backfillAllActiveEmployeeAccrual();
    return Response.json(apiSuccess({ results }, "Accrual backfill complete"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return apiError("Forbidden", "Not authorized", 403);
    }
    return apiError("Server error", "Failed to backfill accrual", 500);
  }
}
