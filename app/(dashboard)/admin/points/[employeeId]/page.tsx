import { AdminEmployeePointsPageClient } from "@/components/admin/points/admin-employee-points-page-client";

/** Employee point detail page. */
export default async function AdminEmployeePointsPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  return <AdminEmployeePointsPageClient employeeId={employeeId} />;
}
