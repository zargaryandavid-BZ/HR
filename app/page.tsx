import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDashboardPathForRole } from "@/lib/utils";

/** Root page redirects to role-appropriate dashboard or login */
export default async function HomePage() {
  const session = await getSession();

  if (session) {
    redirect(getDashboardPathForRole(session.role));
  }

  redirect("/login");
}
