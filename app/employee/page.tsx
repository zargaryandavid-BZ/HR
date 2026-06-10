import { redirect } from "next/navigation";

/** Redirect bare /employee to /employee/dashboard */
export default function EmployeeIndexPage() {
  redirect("/employee/dashboard");
}
