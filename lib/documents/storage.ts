import { createAdminClient } from "@/lib/supabase/admin";
import { ensureStorageBucket } from "@/lib/supabase/storage";

const DOCUMENTS_BUCKET = "onboarding";

/** Upload a PDF document to Supabase Storage */
export async function uploadDocumentPdf(
  file: File
): Promise<{ url: string; path: string; fileName: string; fileSize: number } | null> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return null;
  }

  const bucketReady = await ensureStorageBucket(DOCUMENTS_BUCKET);
  if (!bucketReady) {
    console.error("Document upload error: storage bucket unavailable");
    return null;
  }

  const supabase = createAdminClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `documents/${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, buffer, {
    contentType: file.type || "application/pdf",
    upsert: false,
  });

  if (error) {
    console.error("Document upload error:", error.message);
    return null;
  }

  const { data } = supabase.storage.from(DOCUMENTS_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path, fileName: file.name, fileSize: file.size };
}

/** Extract a display filename from a stored document URL */
export function getFileNameFromUrl(fileUrl: string): string {
  try {
    const parts = fileUrl.split("/");
    const last = decodeURIComponent(parts[parts.length - 1] ?? "document.pdf");
    return last.replace(/^\d+-/, "");
  } catch {
    return "document.pdf";
  }
}

/** Format bytes as a human-readable file size */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const SIGNED_DOC_ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

function resolveSignedDocumentContentType(file: File): string | null {
  if (SIGNED_DOC_ACCEPTED_TYPES.includes(file.type)) {
    return file.type;
  }

  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  return null;
}

/** Upload an employee's signed document copy to Supabase Storage */
export async function uploadSignedDocument(
  employeeId: string,
  documentId: string,
  file: File
): Promise<{ url: string; path: string; fileName: string; fileSize: number } | null> {
  const contentType = resolveSignedDocumentContentType(file);
  if (!contentType) {
    return null;
  }

  const bucketReady = await ensureStorageBucket(DOCUMENTS_BUCKET);
  if (!bucketReady) {
    console.error("Signed document upload error: storage bucket unavailable");
    return null;
  }

  const supabase = createAdminClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `documents/signed/${employeeId}/${documentId}/${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, buffer, {
    contentType,
    upsert: false,
  });

  if (error) {
    console.error("Signed document upload error:", error.message);
    return null;
  }

  const { data } = supabase.storage.from(DOCUMENTS_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path, fileName: file.name, fileSize: file.size };
}

/** Best-effort delete of a signed document from Supabase Storage */
export async function deleteSignedDocumentByUrl(fileUrl: string): Promise<void> {
  try {
    const url = new URL(fileUrl);
    const marker = `/storage/v1/object/public/${DOCUMENTS_BUCKET}/`;
    const idx = url.pathname.indexOf(marker);
    if (idx === -1) return;

    const path = decodeURIComponent(url.pathname.slice(idx + marker.length));
    const supabase = createAdminClient();
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
  } catch {
    // Non-blocking cleanup
  }
}
