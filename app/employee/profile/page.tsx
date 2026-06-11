import { redirect } from "next/navigation";
import { getEmployeeSession } from "@/lib/employee-session";
import { EmployeeProfilePage } from "@/components/employee-portal/employee-profile-page";

export default async function EmployeeProfileRoute() {
  const session = await getEmployeeSession();
  if (!session) redirect("/employee/login");

  return <EmployeeProfilePage />;
}
