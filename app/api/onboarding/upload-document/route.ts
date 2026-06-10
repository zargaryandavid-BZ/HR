import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { uploadOnboardingDocument } from "@/lib/onboarding/storage";

/** Upload a PDF document for a DOCUMENT_SIGN step */
export async function POST(request: NextRequest) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const positionId = formData.get("positionId") as string | null;

    if (!file || !positionId) {
      return apiError("Validation failed", "file and positionId are required");
    }

    if (file.size > 20 * 1024 * 1024) {
      return apiError("Validation failed", "File must be 20MB or less");
    }

    const result = await uploadOnboardingDocument(positionId, file);
    if (!result) {
      return apiError("Upload failed", "Only PDF files are accepted");
    }

    return Response.json(
      apiSuccess({ fileUrl: result.url, fileName: file.name }, "Document uploaded")
    );
  } catch {
    return apiError("Server error", "Failed to upload document", 500);
  }
}
