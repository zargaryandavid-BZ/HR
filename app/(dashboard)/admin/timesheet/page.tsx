import { requireRole } from "@/lib/auth";
import { AdminTimesheetPlaceholder } from "@/components/timesheet/admin-timesheet-placeholder";

/** Admin timesheet page — Phase 2 placeholder */
export default async function AdminTimesheetPage() {
  await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);

  return <AdminTimesheetPlaceholder />;
}
