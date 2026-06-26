import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureStorageBucket } from "@/lib/supabase/storage";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const BUCKET = "onboarding";
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const offer = await prisma.jobOffer.findUnique({ where: { token } });
    if (!offer) return apiError("Not found", "Offer not found", 404);

    if (offer.status !== "APPROVED") {
      return apiError("Invalid", "Offer must be accepted before uploading documents");
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) return apiError("Validation failed", "File is required");

    const contentType =
      ACCEPTED_TYPES.includes(file.type)
        ? file.type
        : file.name.toLowerCase().endsWith(".pdf")
          ? "application/pdf"
          : file.name.toLowerCase().endsWith(".png")
            ? "image/png"
            : file.name.toLowerCase().match(/\.(jpe?g)$/)
              ? "image/jpeg"
              : null;

    if (!contentType) {
      return apiError("Validation failed", "Only PDF, JPG, and PNG files are accepted");
    }

    if (file.size > MAX_SIZE) {
      return apiError("Validation failed", "File must be 10 MB or smaller");
    }

    const bucketReady = await ensureStorageBucket(BUCKET);
    if (!bucketReady) return apiError("Upload failed", "Storage unavailable", 500);

    const supabase = createAdminClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `candidate-intake/${offer.id}/${Date.now()}-${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType,
      upsert: false,
    });

    if (error) {
      console.error("Candidate ID upload error:", error.message);
      return apiError("Upload failed", "Could not upload file", 500);
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return Response.json(
      apiSuccess({ fileUrl: data.publicUrl, fileName: file.name })
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Upload failed";
    return apiError("Failed", msg, 500);
  }
}
