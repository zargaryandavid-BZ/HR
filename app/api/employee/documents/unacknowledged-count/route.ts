import { getSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getUnacknowledgedDocumentCount } from "@/lib/documents/service";

/** Return count of unacknowledged documents for nav badge */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.employeeId) {
      return Response.json(apiSuccess({ count: 0 }));
    }

    const count = await getUnacknowledgedDocumentCount(session.employeeId);
    return Response.json(apiSuccess({ count }));
  } catch {
    return apiError("Server error", "Failed to count documents", 500);
  }
}
