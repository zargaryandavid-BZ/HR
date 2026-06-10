import Link from "next/link";
import {
  CountBadge,
  DashboardEmptyState,
  DashboardPanel,
  EmployeeAvatar,
} from "@/components/admin/dashboard/dashboard-panel";
import {
  formatShortDate,
  getAvatarColor,
} from "@/lib/admin/dashboard-utils";
import { WRITEUP_CATEGORY_LABELS } from "@/lib/individual-settings/constants";
import { isWriteUpAcknowledged } from "@/lib/writeups/constants";
import { cn } from "@/lib/utils";
import type { AdminDashboardData } from "@/lib/admin/dashboard-data";

type RecentWriteUpsCardProps = {
  writeUps: AdminDashboardData["recentWriteUps"];
  unacknowledgedCount: number;
};

/** Recent write-ups with acknowledgment status chips */
export function RecentWriteUpsCard({
  writeUps,
  unacknowledgedCount,
}: RecentWriteUpsCardProps) {
  return (
    <DashboardPanel
      title="Recent write-ups"
      badge={
        unacknowledgedCount > 0 ? (
          <CountBadge
            count={unacknowledgedCount}
            label="pending"
            className="border-amber-200 bg-amber-50 text-amber-700"
          />
        ) : undefined
      }
    >
      {writeUps.length === 0 ? (
        <DashboardEmptyState message="No write-ups this month." />
      ) : (
        <div className="divide-y">
          {writeUps.map((writeUp) => {
            const avatarColor = getAvatarColor(writeUp.employeeId);
            const acknowledged = isWriteUpAcknowledged({
              acknowledgedAt: writeUp.acknowledgedAt,
            });

            return (
              <Link
                key={writeUp.id}
                href={`/admin/employees/${writeUp.employeeId}?tab=write-ups`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40"
              >
                <EmployeeAvatar
                  employeeId={writeUp.employeeId}
                  firstName={writeUp.firstName}
                  lastName={writeUp.lastName}
                  colorClass={avatarColor}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {writeUp.firstName} {writeUp.lastName}
                    </p>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
                        acknowledged
                          ? "border-green-200 bg-green-100 text-green-700"
                          : "border-amber-200 bg-amber-100 text-amber-700"
                      )}
                    >
                      {acknowledged ? "Acknowledged" : "Pending"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {WRITEUP_CATEGORY_LABELS[writeUp.category]} ·{" "}
                    {formatShortDate(writeUp.date)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </DashboardPanel>
  );
}
