"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  daysSince,
  formatReturnDate,
} from "@/lib/admin/dashboard-utils";
import type { AdminDashboardKpis } from "@/lib/admin/dashboard-kpis";

type KpiCardsProps = {
  kpis: AdminDashboardKpis;
};

/** Top-row KPI metric cards for the HR admin dashboard */
export function KpiCards({ kpis: initialKpis }: KpiCardsProps) {
  const { data: kpis = initialKpis } = useQuery({
    queryKey: ["admin-dashboard-kpis"],
    queryFn: async () => {
      const res = await fetch("/api/admin/dashboard/kpis");
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load KPIs");
      return json.data as AdminDashboardKpis;
    },
    initialData: initialKpis,
    staleTime: 0,
  });

  const oldestDays = kpis.oldestUnsignedAssignedAt
    ? daysSince(kpis.oldestUnsignedAssignedAt)
    : null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        title="Employees"
        value={kpis.totalEmployees}
        subLabel={`${kpis.activeEmployees} active · ${kpis.inactiveEmployees} inactive`}
        subLabelClassName="text-green-700"
      />
      <KpiCard
        title="On leave"
        value={kpis.onLeaveToday}
        subLabel={
          kpis.earliestReturn && kpis.onLeaveToday > 0
            ? formatReturnDate(kpis.earliestReturn)
            : kpis.onLeaveToday > 0
              ? "Returns soon"
              : "No one on leave today"
        }
      />
      <KpiCard
        title="Pending approvals"
        value={kpis.pendingApprovalsTotal}
        valueClassName="text-amber-600"
        subLabel={`${kpis.pendingLeaveCount} leave · ${kpis.pendingWriteUpsCount} write-up${kpis.pendingWriteUpsCount !== 1 ? "s" : ""}`}
        subLabelClassName="text-amber-600"
      />
      <KpiCard
        title="Docs unsigned"
        value={kpis.unsignedDocsCount}
        valueClassName="text-red-600"
        subLabel={
          oldestDays !== null
            ? `Oldest: ${oldestDays === 0 ? "today" : `${oldestDays} day${oldestDays !== 1 ? "s" : ""} ago`}`
            : "All caught up"
        }
        subLabelClassName="text-red-600"
      />
    </div>
  );
}

function KpiCard({
  title,
  value,
  subLabel,
  valueClassName,
  subLabelClassName,
}: {
  title: string;
  value: number;
  subLabel: string;
  valueClassName?: string;
  subLabelClassName?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/50 p-4">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className={cn("mt-1 text-3xl font-bold", valueClassName)}>{value}</p>
      <p className={cn("mt-1 text-xs", subLabelClassName ?? "text-muted-foreground")}>
        {subLabel}
      </p>
    </div>
  );
}
