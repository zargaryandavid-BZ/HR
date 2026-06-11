import { requireRole } from "@/lib/auth";
import { AdminLiveBoard } from "@/components/timesheet/admin-live-board";

export default async function AdminTimesheetPage() {
  await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
  return <AdminLiveBoard />;
}
