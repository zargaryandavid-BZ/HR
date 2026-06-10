import { redirect } from "next/navigation";

/** Redirect /admin to the admin dashboard */
export default function AdminIndexPage() {
  redirect("/admin/dashboard");
}
