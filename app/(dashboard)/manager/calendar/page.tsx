import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ManagerCalendarPage() {
  await requireRole(["MANAGER", "HR_ADMIN", "SUPER_ADMIN"]);

  return (
    <div>
      <PageHeader
        title="Team Calendar"
        description="Upcoming leave, holidays, and team events."
      />
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Team calendar view is being built for Phase 2. It will show approved leave,
            company holidays, and scheduled shifts in a monthly grid.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
