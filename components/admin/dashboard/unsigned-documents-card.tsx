import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import {
  CountBadge,
  DashboardEmptyState,
  DashboardPanel,
} from "@/components/admin/dashboard/dashboard-panel";
import { getDocumentAgeChip } from "@/lib/admin/dashboard-utils";
import { cn } from "@/lib/utils";
import type { AdminDashboardData } from "@/lib/admin/dashboard-data";

type UnsignedDocumentsCardProps = {
  assignments: AdminDashboardData["unsignedAssignments"];
  unsignedCount: number;
};

/** Unsigned onboarding documents awaiting employee signature */
export function UnsignedDocumentsCard({
  assignments,
  unsignedCount,
}: UnsignedDocumentsCardProps) {
  return (
    <DashboardPanel
      title="Unsigned documents"
      badge={
        unsignedCount > 0 ? (
          <CountBadge
            count={unsignedCount}
            label="unsigned"
            className="border-red-200 bg-red-50 text-red-700"
          />
        ) : undefined
      }
    >
      {assignments.length === 0 ? (
        <DashboardEmptyState
          message="All documents signed"
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
        />
      ) : (
        <div className="divide-y">
          {assignments.map((assignment) => {
            const ageChip = getDocumentAgeChip(assignment.assignedAt);

            return (
              <Link
                key={assignment.id}
                href={`/admin/employees/${assignment.employeeId}?tab=onboarding-docs`}
                className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{assignment.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {assignment.firstName} {assignment.lastName}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
                    ageChip.className
                  )}
                >
                  {ageChip.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </DashboardPanel>
  );
}
