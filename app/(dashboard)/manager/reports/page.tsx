import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ManagerReportsPage() {
  await requireRole(["MANAGER", "HR_ADMIN", "SUPER_ADMIN"]);

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Attendance, hours, and performance summaries for your team."
      />
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Manager reporting is being built for Phase 2. HR Admins can
            currently export timesheet data as CSV from{" "}
            <strong>Admin → Timesheet → Export CSV</strong>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
