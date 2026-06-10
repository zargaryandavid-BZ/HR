import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureStorageBucket } from "@/lib/supabase/storage";

const BUCKET = "onboarding";

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
];

const MAX_BYTES = 20 * 1024 * 1024;

/** Upload an identity document file to Supabase Storage */
export async function uploadIdentityDocumentFile(
  employeeId: string,
  file: File
): Promise<{ url: string; path: string; fileName: string } | null> {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  const allowed =
    ACCEPTED_TYPES.includes(type) ||
    name.endsWith(".pdf") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".heic");

  if (!allowed) return null;
  if (file.size > MAX_BYTES) return null;

  const bucketReady = await ensureStorageBucket(BUCKET);
  if (!bucketReady) return null;

  const supabase = createAdminClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `identity-documents/${employeeId}/${randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    console.error("Identity document upload error:", error.message);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path, fileName: file.name };
}

/** Remove an identity document file from Supabase Storage when possible */
export async function deleteIdentityDocumentFile(fileUrl: string | null): Promise<void> {
  if (!fileUrl) return;

  try {
    const marker = `/object/public/${BUCKET}/`;
    const idx = fileUrl.indexOf(marker);
    if (idx === -1) return;

    const path = decodeURIComponent(fileUrl.slice(idx + marker.length));
    const supabase = createAdminClient();
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    // Best-effort cleanup — record deletion proceeds even if storage remove fails
  }
}
