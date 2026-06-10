import {
  CountBadge,
  DashboardEmptyState,
  DashboardPanel,
  EmployeeAvatar,
} from "@/components/admin/dashboard/dashboard-panel";
import { getAvatarColor, getProgressColor } from "@/lib/admin/dashboard-utils";
import { cn } from "@/lib/utils";
import type { AdminDashboardData } from "@/lib/admin/dashboard-data";

type OnboardingCardProps = {
  instances: AdminDashboardData["onboardingInProgress"];
};

/** Lists in-progress onboarding instances with step completion bars */
export function OnboardingInProgressCard({ instances }: OnboardingCardProps) {
  return (
    <DashboardPanel
      title="Onboarding in progress"
      badge={
        instances.length > 0 ? (
          <CountBadge
            count={instances.length}
            label="active"
            className="border-blue-200 bg-blue-50 text-blue-700"
          />
        ) : undefined
      }
    >
      {instances.length === 0 ? (
        <DashboardEmptyState message="No onboarding in progress." />
      ) : (
        <div className="divide-y">
          {instances.map((instance) => {
            const colors = getProgressColor(instance.percent);
            const avatarColor = getAvatarColor(instance.employeeId);

            return (
              <div
                key={instance.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <EmployeeAvatar
                  employeeId={instance.employeeId}
                  firstName={instance.firstName}
                  lastName={instance.lastName}
                  colorClass={avatarColor}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium">
                      {instance.firstName} {instance.lastName}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="hidden h-1 w-20 overflow-hidden rounded-sm bg-muted sm:block">
                        <div
                          className="h-full rounded-sm"
                          style={{
                            width: `${instance.percent}%`,
                            backgroundColor: colors.bar,
                          }}
                        />
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          colors.chip
                        )}
                      >
                        {instance.percent}%
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {instance.jobTitle ?? "Employee"} · {instance.completedSteps} of{" "}
                    {instance.totalSteps} steps
                  </p>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-sm bg-muted sm:hidden">
                    <div
                      className="h-full rounded-sm"
                      style={{
                        width: `${instance.percent}%`,
                        backgroundColor: colors.bar,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardPanel>
  );
}
