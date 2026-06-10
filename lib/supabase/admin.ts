import { createClient } from "@supabase/supabase-js";

/** Admin Supabase client — service role key; bypasses RLS. Use in API routes for auth.admin and storage only. */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
