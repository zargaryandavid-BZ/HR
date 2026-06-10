import { createAdminClient } from "@/lib/supabase/admin";

/** Ensure a Supabase Storage bucket exists before uploading */
export async function ensureStorageBucket(
  bucketName: string,
  options: { public?: boolean } = { public: true }
): Promise<boolean> {
  const supabase = createAdminClient();

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error("Storage listBuckets error:", listError.message);
    return false;
  }

  if (buckets?.some((b) => b.name === bucketName)) {
    return true;
  }

  const { error: createError } = await supabase.storage.createBucket(bucketName, {
    public: options.public ?? true,
  });

  if (createError) {
    console.error("Storage createBucket error:", createError.message);
    return false;
  }

  return true;
}
