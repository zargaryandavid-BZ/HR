/**
 * Supabase client entry point — two keys, two purposes:
 *
 * 1. Anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY) — auth only
 *    Use `createBrowserClient` / `createServerClient` from ./supabase/client and ./supabase/server.
 *    Never query application tables with the anon client.
 *
 * 2. Service role key (SUPABASE_SERVICE_ROLE_KEY) — admin operations
 *    Use `createAdminClient` from ./supabase/admin for auth.admin and storage in API routes.
 *    Bypasses RLS automatically; all database reads/writes go through Prisma instead.
 *
 * All API route data access uses Prisma (DATABASE_URL), not Supabase PostgREST.
 */

export { createClient as createBrowserClient } from "@/lib/supabase/client";
export { createClient as createServerClient } from "@/lib/supabase/server";
export { createAdminClient } from "@/lib/supabase/admin";
