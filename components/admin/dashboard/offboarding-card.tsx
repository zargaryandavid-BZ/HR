import { format } from "date-fns";
import {
  CountBadge,
  DashboardEmptyState,
  DashboardPanel,
  EmployeeAvatar,
} from "@/components/admin/dashboard/dashboard-panel";
import { getAvatarColor } from "@/lib/admin/dashboard-utils";
import type { AdminDashboardData } from "@/lib/admin/dashboard-data";

type OffboardingCardProps = {
  instances: AdminDashboardData["offboardingInProgress"];
};

/** Lists employees with active offboarding and pending doc counts */
export function OffboardingInProgressCard({ instances }: OffboardingCardProps) {
  return (
    <DashboardPanel
      title="Offboarding in progress"
      badge={
        instances.length > 0 ? (
          <CountBadge
            count={instances.length}
            label="active"
            className="border-orange-200 bg-orange-50 text-orange-700"
          />
        ) : undefined
      }
    >
      {instances.length === 0 ? (
        <DashboardEmptyState message="No offboarding in progress." />
      ) : (
        <div className="divide-y">
          {instances.map((instance) => {
            const avatarColor = getAvatarColor(instance.employeeId);
            const lastDay = instance.lastDayDate
              ? format(new Date(instance.lastDayDate), "MMM d")
              : "—";

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
                  <p className="truncate text-sm font-medium">
                    {instance.firstName} {instance.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last day {lastDay} · {instance.pendingDocs} doc
                    {instance.pendingDocs !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardPanel>
  );
}
