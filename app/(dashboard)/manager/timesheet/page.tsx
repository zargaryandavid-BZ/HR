import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ManagerTimesheetPage() {
  await requireRole(["MANAGER", "HR_ADMIN", "SUPER_ADMIN"]);

  return (
    <div>
      <PageHeader
        title="Timesheet"
        description="Review and approve your team&apos;s time entries."
      />
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Manager timesheet review and approval is being built for Phase 2.
            HR Admins can currently view and edit all time entries from the{" "}
            <strong>Admin → Timesheet</strong> section.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
