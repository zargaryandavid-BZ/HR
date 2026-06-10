import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import {
  clampImportantDatesDays,
  getAdminImportantDates,
} from "@/lib/admin/important-dates";

/** Upcoming birthdays, anniversaries, and holidays for the admin dashboard */
export async function GET(request: NextRequest) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);

    const daysParam = request.nextUrl.searchParams.get("days");
    const days = clampImportantDatesDays(
      daysParam ? Number.parseInt(daysParam, 10) : undefined
    );

    const items = await getAdminImportantDates(days);

    return Response.json(apiSuccess({ items, days }));
  } catch {
    return apiError("Unauthorized", "Not authorized", 401);
  }
}
