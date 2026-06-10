import { redirect } from "next/navigation";

/** Redirect legacy /admin/sop route to the document repository */
export default function AdminSopRedirectPage() {
  redirect("/admin/documents");
}
