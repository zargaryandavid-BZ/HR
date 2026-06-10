import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import {
  canGenerateHrDocuments,
  canViewEmployeeSettings,
} from "@/lib/individual-settings/auth";
import {
  getLatestHrDocuments,
  syncHrDocuments,
} from "@/lib/individual-settings/hr-documents";

type RouteParams = { params: Promise<{ id: string }> };

function serializeDocuments(
  docs: Awaited<ReturnType<typeof getLatestHrDocuments>>
) {
  return docs
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .map((r) => ({
      id: r.id,
      type: r.type,
      fileUrl: r.fileUrl,
      generatedBy: r.generatedBy,
      generatedAt: r.generatedAt.toISOString(),
    }));
}

/** List HR documents; auto-syncs from employee profile when sync=true */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const { id: employeeId } = await params;

    if (!canViewEmployeeSettings(session, employeeId)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const sync = request.nextUrl.searchParams.get("sync") === "true";

    const docs =
      sync && canGenerateHrDocuments(session)
        ? await syncHrDocuments(employeeId, session.id)
        : await getLatestHrDocuments(employeeId);

    return Response.json(apiSuccess(serializeDocuments(docs)));
  } catch {
    return apiError("Server error", "Failed to fetch generated documents", 500);
  }
}
