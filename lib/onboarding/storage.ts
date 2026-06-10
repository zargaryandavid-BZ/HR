import { createAdminClient } from "@/lib/supabase/admin";
import { ensureStorageBucket } from "@/lib/supabase/storage";

const ONBOARDING_BUCKET = "onboarding";

/** Upload an employee onboarding file to Supabase Storage */
export async function uploadOnboardingFile(
  instanceId: string,
  stepId: string,
  file: File
): Promise<{ url: string; path: string } | null> {
  return uploadToOnboardingBucket(`${instanceId}/${stepId}/${Date.now()}-${sanitizeFileName(file.name)}`, file);
}

/** Upload an employee portal onboarding file using employee-scoped path */
export async function uploadOnboardingEmployeeFile(
  employeeId: string,
  stepId: string,
  file: File
): Promise<{ url: string; path: string } | null> {
  return uploadToOnboardingBucket(
    `${employeeId}/${stepId}/${Date.now()}-${sanitizeFileName(file.name)}`,
    file
  );
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function uploadToOnboardingBucket(
  path: string,
  file: File
): Promise<{ url: string; path: string } | null> {
  const bucketReady = await ensureStorageBucket(ONBOARDING_BUCKET);
  if (!bucketReady) return null;

  const supabase = createAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from(ONBOARDING_BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    console.error("Onboarding file upload error:", error.message);
    return null;
  }

  const { data } = supabase.storage.from(ONBOARDING_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

/** Upload a PDF document for a DOCUMENT_SIGN step during flow building */
export async function uploadOnboardingDocument(
  positionId: string,
  file: File
): Promise<{ url: string; path: string } | null> {
  if (file.type !== "application/pdf") {
    return null;
  }

  const bucketReady = await ensureStorageBucket(ONBOARDING_BUCKET);
  if (!bucketReady) return null;

  const supabase = createAdminClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `templates/${positionId}/${Date.now()}-${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from(ONBOARDING_BUCKET).upload(path, buffer, {
    contentType: "application/pdf",
    upsert: false,
  });

  if (error) {
    console.error("Onboarding document upload error:", error.message);
    return null;
  }

  const { data } = supabase.storage.from(ONBOARDING_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}
