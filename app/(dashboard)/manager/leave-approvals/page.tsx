import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ManagerLeaveApprovalsPage() {
  await requireRole(["MANAGER", "HR_ADMIN", "SUPER_ADMIN"]);

  return (
    <div>
      <PageHeader
        title="Leave Approvals"
        description="Approve or reject leave requests from your team."
      />
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Manager leave approval workflow is being built for Phase 2.
            HR Admins can currently manage all leave requests from{" "}
            <strong>Admin → Leave Requests</strong>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
