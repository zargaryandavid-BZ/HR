import { createAdminClient } from "@/lib/supabase/admin";
import { ensureStorageBucket } from "@/lib/supabase/storage";

const BUCKET = "onboarding";

const WRITEUP_ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

/** Upload a write-up attachment to Supabase Storage */
export async function uploadWriteUpAttachment(
  employeeId: string,
  file: File
): Promise<{ url: string; path: string; fileName: string } | null> {
  if (!WRITEUP_ACCEPTED_TYPES.includes(file.type)) {
    return null;
  }

  if (file.size > 10 * 1024 * 1024) {
    return null;
  }

  const bucketReady = await ensureStorageBucket(BUCKET);
  if (!bucketReady) return null;

  const supabase = createAdminClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `writeups/${employeeId}/${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    console.error("Write-up upload error:", error.message);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path, fileName: file.name };
}

/** Upload a generated HR document PDF to Supabase Storage */
export async function uploadHrDocumentPdf(
  employeeId: string,
  type: string,
  pdfBytes: Uint8Array
): Promise<{ url: string; path: string } | null> {
  const bucketReady = await ensureStorageBucket(BUCKET);
  if (!bucketReady) return null;

  const supabase = createAdminClient();
  const path = `hr-documents/${employeeId}/${type}-${Date.now()}.pdf`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, pdfBytes, {
    contentType: "application/pdf",
    upsert: false,
  });

  if (error) {
    console.error("HR document upload error:", error.message);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}
