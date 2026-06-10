import { redirect } from "next/navigation";

/** Portal preview is no longer available — redirect to login */
export default function PortalPreviewRedirectPage() {
  redirect("/employee/login");
}
