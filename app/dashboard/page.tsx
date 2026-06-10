import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPathForRole } from "@/lib/utils";

/** /dashboard redirects to the role-appropriate dashboard */
export default async function DashboardRedirectPage() {
  const session = await getSession();

  if (session) {
    if (session.mustChangePassword) {
      redirect("/change-password");
    }

    if (session.role === "EMPLOYEE") {
      redirect("/employee/login");
    }

    redirect(getDashboardPathForRole(session.role));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.auth.signOut();
    redirect("/login?error=not_linked");
  }

  redirect("/login");
}
