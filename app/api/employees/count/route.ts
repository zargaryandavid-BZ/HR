import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

/** Return total number of employees for sidebar display */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return apiError("Unauthorized", "Not authenticated", 401);
    }
    if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const count = await prisma.employee.count();

    return Response.json(apiSuccess({ count }));
  } catch {
    return apiError("Server error", "Failed to fetch employee count", 500);
  }
}
