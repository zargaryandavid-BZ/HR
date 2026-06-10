import { redirect } from "next/navigation";
import { getEmployeeSession } from "@/lib/employee-session";
import { EmployeeDashboard } from "@/components/employee-portal/employee-dashboard";

/** Employee self-service dashboard */
export default async function EmployeeDashboardPage() {
  const session = await getEmployeeSession();
  if (!session) redirect("/employee/login");

  return <EmployeeDashboard />;
}
