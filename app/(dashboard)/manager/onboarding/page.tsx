import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ManagerOnboardingPage() {
  await requireRole(["MANAGER", "HR_ADMIN", "SUPER_ADMIN"]);

  return (
    <div>
      <PageHeader
        title="Onboarding"
        description="Track onboarding progress for new team members."
      />
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Manager onboarding tracking is being built for Phase 2.
            HR Admins can currently manage onboarding from{" "}
            <strong>Admin → Onboarding</strong>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
