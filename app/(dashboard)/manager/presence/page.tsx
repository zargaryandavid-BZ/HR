import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ManagerPresencePage() {
  await requireRole(["MANAGER", "HR_ADMIN", "SUPER_ADMIN"]);

  return (
    <div>
      <PageHeader
        title="Team Presence"
        description="Real-time clock-in status for your direct reports."
      />
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Live team presence board — who&apos;s clocked in, on break, or absent — is being built for Phase 2.
            In the meantime, use the <strong>Admin Timesheet</strong> for a real-time view.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
