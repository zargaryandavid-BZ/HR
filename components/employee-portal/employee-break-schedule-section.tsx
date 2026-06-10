"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Coffee, Info, UtensilsCrossed } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatBreakTime, isMealDeadlineApproaching } from "@/lib/breaks/schedule-helpers";
import { EmployeeDashboardSection } from "./employee-dashboard-section";

type BreakScheduleData = {
  noShiftToday: boolean;
  dayName: string;
  shiftStart: string | null;
  shiftEnd: string | null;
  totalHours: number;
  restBreakCount: number;
  restBreakMinutes: number;
  restBreakTimes: string[];
  mealBreakCount: number;
  mealBreakMinutes: number;
  mealBreak1LatestStart: string | null;
  mealBreak2LatestStart: string | null;
  mealBreak1WaiverEnabled: boolean;
  mealBreak2WaiverEnabled: boolean;
  totalPaidBreakMinutes: number;
  totalUnpaidBreakMinutes: number;
};

/** Today's break schedule based on California labor law */
export function EmployeeBreakScheduleSection() {
  const [viewWeek, setViewWeek] = useState(false);

  const { data, isLoading } = useQuery<BreakScheduleData>({
    queryKey: ["employee-break-schedule"],
    queryFn: async () => {
      const res = await fetch("/api/employee/break-schedule");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load break schedule");
      return json.data as BreakScheduleData;
    },
  });

  const todayLabel = format(new Date(), "EEEE, MMM d");
  const sectionTitle = `My Break Schedule — ${todayLabel}`;

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <EmployeeDashboardSection
      title={sectionTitle}
      actions={
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7"
          onClick={() => setViewWeek((v) => !v)}
        >
          {viewWeek ? "Today only" : "View week"}
        </Button>
      }
    >
      {viewWeek ? (
        <WeekBreakTable />
      ) : !data ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Break schedule unavailable.
        </p>
      ) : data.noShiftToday ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No shift scheduled today.
        </p>
      ) : (
        <BreakScheduleContent data={data} />
      )}
    </EmployeeDashboardSection>
  );
}

function BreakScheduleContent({ data }: { data: BreakScheduleData }) {
  return (
    <div className="space-y-4 text-sm">
      {data.shiftStart && data.shiftEnd && (
        <p className="text-muted-foreground">
          Shift: {formatBreakTime(data.shiftStart)} – {formatBreakTime(data.shiftEnd)} (
          {data.totalHours.toFixed(1)} hours)
        </p>
      )}

      {data.restBreakCount > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-medium">
            <Coffee className="h-4 w-4 text-amber-600" />
            Rest Breaks (paid) — {data.restBreakCount} breaks × {data.restBreakMinutes} min
          </div>
          <div className="rounded-lg border divide-y">
            {data.restBreakTimes.map((time, index) => (
              <div
                key={time}
                className="flex items-center justify-between px-3 py-2 text-xs sm:text-sm"
              >
                <span>Break {index + 1}</span>
                <span className="text-muted-foreground">~{formatBreakTime(time)}</span>
                <span>{data.restBreakMinutes} min</span>
                <span className="text-green-700 font-medium">Paid</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.mealBreakCount > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-medium">
            <UtensilsCrossed className="h-4 w-4 text-slate-600" />
            Meal Breaks (unpaid) — {data.mealBreakCount} breaks × {data.mealBreakMinutes} min
          </div>
          <div className="rounded-lg border divide-y">
            {data.mealBreak1LatestStart && (
              <MealBreakRow
                label="Meal 1"
                deadline={data.mealBreak1LatestStart}
                minutes={data.mealBreakMinutes}
              />
            )}
            {data.mealBreak2LatestStart && (
              <MealBreakRow
                label="Meal 2"
                deadline={data.mealBreak2LatestStart}
                minutes={data.mealBreakMinutes}
              />
            )}
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground space-y-0.5">
        <p>Total paid break time: {data.totalPaidBreakMinutes} min</p>
        <p>Total unpaid break time: {data.totalUnpaidBreakMinutes} min</p>
      </div>

      {(data.mealBreak1WaiverEnabled || data.mealBreak2WaiverEnabled) && (
        <p className="flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {data.mealBreak1WaiverEnabled && "Your first meal break waiver is active (by mutual agreement). "}
          {data.mealBreak2WaiverEnabled && "Your second meal break waiver is active (by mutual agreement)."}
        </p>
      )}

      <div className="text-xs text-muted-foreground space-y-1 border-t pt-3">
        <p className="flex items-start gap-1.5">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          Rest breaks and meal breaks cannot be combined.
        </p>
        <p className="flex items-start gap-1.5">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          You must be fully off duty during meal breaks.
        </p>
      </div>
    </div>
  );
}

function MealBreakRow({
  label,
  deadline,
  minutes,
}: {
  label: string;
  deadline: string;
  minutes: number;
}) {
  const approaching = isMealDeadlineApproaching(deadline);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs sm:text-sm">
      <span>{label}</span>
      <span className={cn(approaching && "text-amber-700 font-medium")}>
        Must start by {formatBreakTime(deadline)}
      </span>
      <span>{minutes} min</span>
      <span className="text-muted-foreground">Unpaid</span>
    </div>
  );
}

function WeekBreakTable() {
  const { data: weekData, isLoading } = useQuery<BreakScheduleData[]>({
    queryKey: ["employee-break-schedule-week"],
    queryFn: async () => {
      const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
      const results = await Promise.all(
        weekdays.map(async (weekday) => {
          const res = await fetch(`/api/employee/break-schedule?weekday=${weekday}`);
          const json = await res.json();
          return json.data as BreakScheduleData;
        })
      );
      return results;
    },
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="pb-2 text-left font-medium">Day</th>
            <th className="pb-2 text-left font-medium">Shift</th>
            <th className="pb-2 text-left font-medium">Rest</th>
            <th className="pb-2 text-left font-medium">Meal</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {weekData?.map((day) => (
            <tr key={day.dayName}>
              <td className="py-2 font-medium">{day.dayName.slice(0, 3)}</td>
              <td className="py-2 text-muted-foreground">
                {day.noShiftToday
                  ? "Off"
                  : `${formatBreakTime(day.shiftStart!)} – ${formatBreakTime(day.shiftEnd!)}`}
              </td>
              <td className="py-2">{day.noShiftToday ? "—" : `${day.restBreakCount}×10m`}</td>
              <td className="py-2">{day.noShiftToday ? "—" : `${day.mealBreakCount}×30m`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
