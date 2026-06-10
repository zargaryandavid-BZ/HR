import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client — anon key, auth only (sign-in, sign-out, session). Never query tables. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
