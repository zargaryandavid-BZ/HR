"use client";

import { useQuery } from "@tanstack/react-query";
import { format, formatDuration, intervalToDuration } from "date-fns";
import { formatDisplayWeekdayDate } from "@/lib/dates";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { EmployeeClockWidget } from "@/components/employee-portal/employee-clock-widget";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type BreakEntry = {
  id: string;
  breakType: "REST" | "MEAL";
  startedAt: string;
  endedAt: string | null;
  durationMin: number | null;
};

type TimeEntry = {
  id: string;
  clockIn: string;
  clockOut: string | null;
  hoursWorked: number | null;
  status: string;
  clockInMethod: string;
  breaks: BreakEntry[];
};

const STATUS_COLOR: Record<string, string> = {
  IN_PROGRESS: "bg-green-100 text-green-800",
  ON_BREAK:    "bg-amber-100 text-amber-800",
  COMPLETED:   "bg-slate-100 text-slate-700",
  APPROVED:    "bg-blue-100 text-blue-700",
  FLAGGED:     "bg-red-100 text-red-700",
};

function hoursLabel(h: number): string {
  const d = intervalToDuration({ start: 0, end: Math.round(h * 3600) * 1000 });
  return formatDuration({ hours: d.hours, minutes: d.minutes }, { format: ["hours", "minutes"] }) || "0m";
}

export default function EmployeeTimePage() {
  const { data: entries, isLoading } = useQuery<TimeEntry[]>({
    queryKey: ["employee-time-entries"],
    queryFn: async () => {
      const res = await fetch("/api/employee/time-entries");
      const json = await res.json();
      return json.data;
    },
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="My Time"
        description="Your clock-in history for the last 4 weeks."
      />

      <EmployeeClockWidget />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : !entries?.length ? (
        <EmptyState title="No time entries yet" description="Your clock-in history will appear here." />
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const totalBreakMin = entry.breaks
              .filter((b) => b.durationMin != null)
              .reduce((s, b) => s + (b.durationMin ?? 0), 0);

            return (
              <Card key={entry.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">
                          {formatDisplayWeekdayDate(entry.clockIn)}
                        </p>
                        <Badge className={`text-xs ${STATUS_COLOR[entry.status] ?? "bg-slate-100"}`} variant="outline">
                          {entry.status.replace("_", " ")}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{entry.clockInMethod}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(entry.clockIn), "h:mm a")}
                        {" → "}
                        {entry.clockOut ? format(new Date(entry.clockOut), "h:mm a") : "In progress"}
                        {totalBreakMin > 0 && (
                          <span className="ml-2">· {Math.round(totalBreakMin)}m break</span>
                        )}
                      </p>
                      {entry.breaks.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {entry.breaks.map((b) => (
                            <span key={b.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                              {b.breakType === "MEAL" ? "🍽 Lunch" : "☕ Rest"}
                              {b.durationMin != null ? ` ${Math.round(b.durationMin)}m` : " (open)"}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {entry.hoursWorked != null && (
                      <div className="text-right shrink-0">
                        <p className="text-lg font-semibold">{hoursLabel(entry.hoursWorked)}</p>
                        <p className="text-xs text-muted-foreground">worked</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
