"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, CheckCircle2, Calendar, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

type Stats = {
  pendingCount: number;
  onLeaveTodayCount: number;
  approvedThisMonthCount: number;
  upcomingCount: number;
};

type StatCardProps = {
  title: string;
  value: number;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
};

function StatCard({ title, value, icon: Icon, colorClass, bgClass }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className={cn("text-3xl font-bold", colorClass)}>{value}</p>
          </div>
          <div className={cn("rounded-lg p-2", bgClass)}>
            <Icon className={cn("h-5 w-5", colorClass)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Stats row displaying leave summary counts */
export function LeaveStatsCards({ refreshKey }: { refreshKey?: number }) {
  const { data, isLoading } = useQuery<Stats>({
    queryKey: ["leave-stats", refreshKey],
    queryFn: async () => {
      const res = await fetch("/api/leave/stats");
      const json = await res.json();
      return json.data;
    },
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = data ?? {
    pendingCount: 0,
    onLeaveTodayCount: 0,
    approvedThisMonthCount: 0,
    upcomingCount: 0,
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Pending Approval"
        value={stats.pendingCount}
        icon={Clock}
        colorClass="text-amber-600"
        bgClass="bg-amber-50 dark:bg-amber-950"
      />
      <StatCard
        title="On Leave Today"
        value={stats.onLeaveTodayCount}
        icon={CheckCircle2}
        colorClass="text-green-600"
        bgClass="bg-green-50 dark:bg-green-950"
      />
      <StatCard
        title="Approved This Month"
        value={stats.approvedThisMonthCount}
        icon={TrendingUp}
        colorClass="text-foreground"
        bgClass="bg-muted"
      />
      <StatCard
        title="Upcoming Requests"
        value={stats.upcomingCount}
        icon={Calendar}
        colorClass="text-blue-600"
        bgClass="bg-blue-50 dark:bg-blue-950"
      />
    </div>
  );
}
