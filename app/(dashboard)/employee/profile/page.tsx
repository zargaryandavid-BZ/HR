import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { EmployeeProfileSettings } from "@/components/employees/employee-profile-settings";

/** Employee profile page with documents, write-ups, and manager notes */
export default async function EmployeeProfilePage() {
  await requireRole(["EMPLOYEE", "MANAGER", "HR_ADMIN", "SUPER_ADMIN"]);

  return (
    <div>
      <PageHeader
        title="My Profile"
        description="View your documents, write-ups, and notes"
      />
      <EmployeeProfileSettings />
    </div>
  );
}
