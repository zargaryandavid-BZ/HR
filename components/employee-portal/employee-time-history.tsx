"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isToday, parseISO, subDays, startOfDay, isAfter } from "date-fns";
import { formatDisplayDateWithWeekday } from "@/lib/dates";
import { Clock, Coffee, Utensils, LogIn, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeDashboardSection } from "./employee-dashboard-section";
import { ChevronDown } from "lucide-react";
import { formatHoursAsHm, formatMinutesAsHm } from "@/lib/time/hours-worked";

type BreakRecord = {
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
  breaks: BreakRecord[];
};

function fmtTime(iso: string): string {
  return format(parseISO(iso), "h:mm a");
}

function breakDurationMin(brk: BreakRecord): number | null {
  if (brk.durationMin != null) return Math.round(brk.durationMin);
  if (!brk.endedAt) return null;
  const ms = parseISO(brk.endedAt).getTime() - parseISO(brk.startedAt).getTime();
  return ms > 0 ? Math.round(ms / 60000) : null;
}

function formatBreakDuration(brk: BreakRecord): string | null {
  const minutes = breakDurationMin(brk);
  if (minutes == null) return null;
  return formatMinutesAsHm(minutes);
}

// ─── Today's Timeline ────────────────────────────────────────────────────────

type TimelineEvent =
  | { kind: "clock-in"; time: string }
  | { kind: "break"; breakType: "REST" | "MEAL"; startedAt: string; endedAt: string | null; durationMin: number | null }
  | { kind: "clock-out"; time: string }
  | { kind: "in-progress" };

function buildTimeline(entry: TimeEntry): TimelineEvent[] {
  const events: TimelineEvent[] = [{ kind: "clock-in", time: entry.clockIn }];

  for (const brk of entry.breaks) {
    events.push({
      kind: "break",
      breakType: brk.breakType,
      startedAt: brk.startedAt,
      endedAt: brk.endedAt,
      durationMin: brk.durationMin,
    });
  }

  if (entry.clockOut) {
    events.push({ kind: "clock-out", time: entry.clockOut });
  } else {
    events.push({ kind: "in-progress" });
  }

  return events;
}

function TimelineDot({ kind, breakType }: { kind: TimelineEvent["kind"]; breakType?: "REST" | "MEAL" }) {
  if (kind === "clock-in") {
    return (
      <div className="w-7 h-7 rounded-full bg-green-100 border-2 border-green-400 flex items-center justify-center shrink-0">
        <LogIn className="h-3 w-3 text-green-600" />
      </div>
    );
  }
  if (kind === "clock-out") {
    return (
      <div className="w-7 h-7 rounded-full bg-red-100 border-2 border-red-400 flex items-center justify-center shrink-0">
        <LogOut className="h-3 w-3 text-red-600" />
      </div>
    );
  }
  if (kind === "break") {
    return (
      <div className="w-7 h-7 rounded-full bg-amber-100 border-2 border-amber-400 flex items-center justify-center shrink-0">
        {breakType === "MEAL" ? (
          <Utensils className="h-3 w-3 text-amber-600" />
        ) : (
          <Coffee className="h-3 w-3 text-amber-600" />
        )}
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-full bg-blue-100 border-2 border-blue-300 flex items-center justify-center shrink-0">
      <Clock className="h-3 w-3 text-blue-500" />
    </div>
  );
}

function TodayTimeline({ entry }: { entry: TimeEntry }) {
  const events = buildTimeline(entry);

  return (
    <div className="space-y-0">
      {events.map((evt, i) => {
        const isLast = i === events.length - 1;

        let label: string;
        let sub: string | null = null;

        if (evt.kind === "clock-in") {
          label = `Clock In · ${fmtTime(evt.time)}`;
        } else if (evt.kind === "clock-out") {
          label = `Clock Out · ${fmtTime(evt.time)}`;
        } else if (evt.kind === "break") {
          const typeLabel = evt.breakType === "MEAL" ? "Meal Break" : "Rest Break";
          if (evt.endedAt) {
            label = typeLabel;
            const duration = formatBreakDuration({
              id: "",
              breakType: evt.breakType,
              startedAt: evt.startedAt,
              endedAt: evt.endedAt,
              durationMin: evt.durationMin,
            });
            sub = `${fmtTime(evt.startedAt)} → ${fmtTime(evt.endedAt)}${duration ? ` · ${duration}` : ""}`;
          } else {
            label = `${typeLabel} started · ${fmtTime(evt.startedAt)}`;
            sub = "In progress";
          }
        } else {
          label = "In progress";
        }

        const dotKind = evt.kind;
        const breakType = evt.kind === "break" ? evt.breakType : undefined;

        return (
          <div key={i} className="flex gap-3">
            {/* dot + connector */}
            <div className="flex flex-col items-center">
              <TimelineDot kind={dotKind} breakType={breakType} />
              {!isLast && <div className="w-0.5 flex-1 bg-slate-200 my-1" />}
            </div>

            {/* content */}
            <div className={cn("flex-1 min-w-0", isLast ? "pb-0" : "pb-3")}>
              <p className={cn(
                "text-sm font-medium",
                evt.kind === "clock-in" && "text-green-700",
                evt.kind === "clock-out" && "text-red-700",
                evt.kind === "break" && "text-amber-700",
                evt.kind === "in-progress" && "text-blue-600",
              )}>
                {label}
              </p>
              {sub && (
                <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Recent Shift Row ─────────────────────────────────────────────────────────

function ShiftRow({ entry }: { entry: TimeEntry }) {
  const [open, setOpen] = useState(false);

  const dateLabel = formatDisplayDateWithWeekday(entry.clockIn);
  const clockInTime = fmtTime(entry.clockIn);
  const clockOutTime = entry.clockOut ? fmtTime(entry.clockOut) : "—";
  const hoursLabel = entry.hoursWorked != null ? formatHoursAsHm(entry.hoursWorked) : null;

  const completedBreaks = entry.breaks.filter((b) => b.endedAt != null);
  const totalBreakMin = completedBreaks.reduce(
    (acc, b) => acc + (breakDurationMin(b) ?? 0),
    0
  );
  const breakCount = entry.breaks.length;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
          <span className="text-sm font-medium text-slate-700 shrink-0">{dateLabel}</span>
          <span className="text-xs text-muted-foreground shrink-0">
            {clockInTime} → {clockOutTime}
          </span>
          {hoursLabel && (
            <Badge variant="secondary" className="text-xs h-5 shrink-0">
              {hoursLabel}
            </Badge>
          )}
          {breakCount > 0 && (
            <span className="text-xs text-muted-foreground shrink-0">
              {breakCount} break{breakCount !== 1 ? "s" : ""}{totalBreakMin > 0 ? ` · ${formatMinutesAsHm(totalBreakMin)} total` : ""}
            </span>
          )}
        </div>
        {breakCount > 0 && (
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        )}
      </button>

      {open && breakCount > 0 && (
        <div className="border-t bg-slate-50 px-4 py-3 space-y-2">
          {entry.breaks.map((brk) => (
            <div key={brk.id} className="flex items-center gap-2 text-xs text-slate-600">
              {brk.breakType === "MEAL" ? (
                <Utensils className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              ) : (
                <Coffee className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              )}
              <span className="font-medium">{brk.breakType === "MEAL" ? "Meal" : "Rest"}</span>
              <span className="text-muted-foreground">
                {fmtTime(brk.startedAt)}
                {brk.endedAt ? ` → ${fmtTime(brk.endedAt)}` : " (open)"}
                {formatBreakDuration(brk) ? ` · ${formatBreakDuration(brk)}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EmployeeTimeHistory() {
  const { data: entries, isLoading } = useQuery<TimeEntry[]>({
    queryKey: ["employee-time-entries"],
    queryFn: async () => {
      const res = await fetch("/api/employee/time-entries");
      const json = await res.json();
      return json.data ?? [];
    },
  });

  if (isLoading) {
    return (
      <EmployeeDashboardSection title="Time History" defaultOpen={true}>
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </EmployeeDashboardSection>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <EmployeeDashboardSection title="Time History" defaultOpen={true}>
        <p className="text-sm text-muted-foreground">No time entries in the last 4 weeks.</p>
      </EmployeeDashboardSection>
    );
  }

  // Today's entry — the first entry whose clockIn is today (entries are desc by clockIn)
  const todayEntry = entries.find((e) => isToday(parseISO(e.clockIn)));

  // Recent shifts: entries from the last 7 days (excluding today), up to 7 days back
  const sevenDaysAgo = startOfDay(subDays(new Date(), 7));
  const recentEntries = entries.filter(
    (e) => !isToday(parseISO(e.clockIn)) && isAfter(parseISO(e.clockIn), sevenDaysAgo)
  );

  return (
    <EmployeeDashboardSection title="Time History" defaultOpen={true}>
      <div className="space-y-5">
        {/* Today's Timeline */}
        {todayEntry ? (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Today
            </h3>
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="pt-4 pb-3 px-4">
                <TodayTimeline entry={todayEntry} />
              </CardContent>
            </Card>
          </div>
        ) : (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Today
            </h3>
            <p className="text-sm text-muted-foreground">No shift recorded today.</p>
          </div>
        )}

        {/* Recent Shifts */}
        {recentEntries.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Recent Shifts
            </h3>
            <div className="space-y-2">
              {recentEntries.map((entry) => (
                <ShiftRow key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        )}
      </div>
    </EmployeeDashboardSection>
  );
}
