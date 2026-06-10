import { redirect } from "next/navigation";

/** Redirect legacy /sop route to employee documents */
export default function SopRedirectPage() {
  redirect("/employee/documents");
}
