import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { uploadDocumentPdf } from "@/lib/documents/storage";

const MAX_SIZE = 20 * 1024 * 1024;

/** Upload a PDF for the document repository */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);
    if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return apiError("Validation failed", "PDF file is required");
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return apiError("Validation failed", "Only PDF files are accepted");
    }
    if (file.size > MAX_SIZE) {
      return apiError("Validation failed", "File must be 20 MB or smaller");
    }

    const result = await uploadDocumentPdf(file);
    if (!result) {
      return apiError(
        "Upload failed",
        "Could not upload PDF. Check Supabase Storage configuration.",
        500
      );
    }

    return Response.json(
      apiSuccess({
        fileUrl: result.url,
        fileName: result.fileName,
        fileSize: result.fileSize,
      })
    );
  } catch {
    return apiError("Server error", "Failed to upload document", 500);
  }
}
