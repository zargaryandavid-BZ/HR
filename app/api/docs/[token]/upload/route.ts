import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { uploadViaShareToken } from "@/lib/document-share/service";

type RouteParams = { params: Promise<{ token: string }> };

const MAX_SIZE_MB = 10;

/** Public upload endpoint for signed documents via share token */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;
    const formData = await request.formData();
    const documentId = formData.get("documentId") as string | null;
    const file = formData.get("file") as File | null;

    if (!documentId) {
      return apiError("Validation failed", "documentId is required");
    }
    if (!file) {
      return apiError("Validation failed", "File is required");
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return apiError("Validation failed", `File must be ${MAX_SIZE_MB}MB or less`);
    }

    const result = await uploadViaShareToken(token, documentId, file);

    if ("error" in result && result.error) {
      if (result.error === "invalid") {
        return apiError("Not found", "Invalid link", 404);
      }
      if (result.error === "expired") {
        return apiError("Expired", "This link has expired", 410);
      }
      if (result.error === "document_not_found") {
        return apiError("Not found", "Document not found", 404);
      }
      return apiError("Validation failed", "File must be PDF, JPG, JPEG, or PNG");
    }

    if (!("signedFileUrl" in result)) {
      return apiError("Server error", "Upload failed", 500);
    }

    return Response.json(
      apiSuccess({
        signedFileUrl: result.signedFileUrl,
        fileName: result.fileName,
        progress: { completed: result.uploadedCount, total: result.total },
      })
    );
  } catch {
    return apiError("Server error", "Failed to upload document", 500);
  }
}
