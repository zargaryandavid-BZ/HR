"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { BreakScheduleResponse } from "@/lib/breaks/types";
import {
  breakResponseToDaySchedule,
  formatBreakTime,
  getWaiverEligibilityFromWeek,
  groupWeeklyBreakDays,
  type DayBreakSchedule,
} from "@/lib/breaks/schedule-helpers";
import type { EmployeeFormValues } from "@/lib/validations";

type BreakScheduleSectionProps = {
  employeeId: string;
  scheduleType: EmployeeFormValues["scheduleType"];
  /** Bust cache when saved schedule changes (e.g. employee.updatedAt) */
  scheduleRevision?: string;
  mealBreak1WaiverEnabled: boolean;
  mealBreak2WaiverEnabled: boolean;
  onSaved?: (message: string) => void;
  onError?: (message: string) => void;
  className?: string;
};

const WEEKDAY_PARAMS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

/** Read-only break schedule from saved employee data (same API as employee portal) */
export function BreakScheduleSection({
  employeeId,
  scheduleType,
  scheduleRevision,
  mealBreak1WaiverEnabled,
  mealBreak2WaiverEnabled,
  onSaved,
  onError,
  className,
}: BreakScheduleSectionProps) {
  const [waiver1, setWaiver1] = useState(mealBreak1WaiverEnabled);
  const [waiver2, setWaiver2] = useState(mealBreak2WaiverEnabled);

  const { data: weeklyDays, isLoading } = useQuery({
    queryKey: ["admin-break-schedule", employeeId, scheduleRevision],
    queryFn: async () => {
      const responses = await Promise.all(
        WEEKDAY_PARAMS.map(async (weekday) => {
          const res = await fetch(
            `/api/employees/${employeeId}/break-schedule?weekday=${weekday}`
          );
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Failed to load break schedule");
          return json.data as BreakScheduleResponse;
        })
      );

      return responses.map(breakResponseToDaySchedule) as DayBreakSchedule[];
    },
    enabled: scheduleType === "FIXED",
  });

  const groupedDays = useMemo(
    () => (weeklyDays ? groupWeeklyBreakDays(weeklyDays) : []),
    [weeklyDays]
  );

  const waiverEligibility = useMemo(
    () => (weeklyDays ? getWaiverEligibilityFromWeek(weeklyDays) : { mealBreak1CanBeWaived: false, mealBreak2CanBeWaived: false }),
    [weeklyDays]
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mealBreak1WaiverEnabled: waiver1,
          mealBreak2WaiverEnabled: waiver2,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? "Failed to save waiver settings");
      }
    },
    onSuccess: () => onSaved?.("Meal break waiver settings saved"),
    onError: (err: Error) => onError?.(err.message),
  });

  if (scheduleType !== "FIXED") {
    return (
      <Card className={cn("mt-0 h-full", className)}>
        <CardHeader>
          <CardTitle className="text-base">Break Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Break schedules are automatically calculated for employees with a fixed weekly
            schedule. Switch to a fixed schedule with daily start/end times to view breaks.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={cn("mt-0 h-full", className)}>
        <CardHeader>
          <CardTitle className="text-base">Break Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("mt-0 h-full", className)}>
      <CardHeader>
        <CardTitle className="text-base">Break Schedule</CardTitle>
        <p className="text-sm text-muted-foreground">
          Saved schedule — matches what the employee sees in their portal.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {groupedDays.map((group) => {
            const day = group.representative;

            if (day.unavailable || !day.breaks) {
              return (
                <div key={group.label} className="text-sm">
                  <span className="font-medium">{group.label}</span>
                  <span className="text-muted-foreground"> — Unavailable, no breaks required</span>
                </div>
              );
            }

            const breaks = day.breaks;
            const shiftLabel = `${formatBreakTime(day.shiftStart!)} – ${formatBreakTime(day.shiftEnd!)}`;

            return (
              <div key={group.label} className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span>{group.label}</span>
                  <span>
                    {shiftLabel} ({breaks.totalHours.toFixed(1)} hrs)
                  </span>
                  {group.sameAsPrevious && (
                    <span className="text-xs text-muted-foreground font-normal">(same as previous)</span>
                  )}
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-2">
                  <p>
                    <span className="font-medium">Rest breaks</span>{" "}
                    {breaks.restBreakCount} × {breaks.restBreakMinutes} min (paid)
                  </p>
                  {breaks.restBreakTimes.length > 0 && (
                    <p className="text-muted-foreground">
                      Suggested:{" "}
                      {breaks.restBreakTimes.map((t) => `~${formatBreakTime(t)}`).join(" · ")}
                    </p>
                  )}
                  <p>
                    <span className="font-medium">Meal breaks</span>{" "}
                    {breaks.mealBreakCount} × {breaks.mealBreakMinutes} min (unpaid)
                  </p>
                  {breaks.mealBreak1LatestStart && (
                    <p className="text-muted-foreground">
                      1st meal: Must start by {formatBreakTime(breaks.mealBreak1LatestStart)}
                    </p>
                  )}
                  {breaks.mealBreak2LatestStart && (
                    <p className="text-muted-foreground">
                      2nd meal: Must start by {formatBreakTime(breaks.mealBreak2LatestStart)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t pt-4 space-y-4">
          <div>
            <h4 className="text-sm font-semibold">Meal Break Waivers</h4>
            <p className="text-xs text-muted-foreground mt-1">
              These require a signed mutual agreement between employer and employee.
            </p>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="meal-waiver-1"
              checked={waiver1}
              disabled={!waiverEligibility.mealBreak1CanBeWaived}
              onCheckedChange={(checked) => setWaiver1(checked === true)}
            />
            <div className="space-y-0.5">
              <Label htmlFor="meal-waiver-1" className="font-normal cursor-pointer">
                First meal break waiver enabled
              </Label>
              <p className="text-xs text-muted-foreground">
                Only available for shifts ≤ 6 hours. Employee has agreed to waive.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="meal-waiver-2"
              checked={waiver2}
              disabled={!waiverEligibility.mealBreak2CanBeWaived || waiver1}
              onCheckedChange={(checked) => setWaiver2(checked === true)}
            />
            <div className="space-y-0.5">
              <Label htmlFor="meal-waiver-2" className="font-normal cursor-pointer">
                Second meal break waiver enabled
              </Label>
              <p className="text-xs text-muted-foreground">
                Only available for shifts ≤ 12 hours where first meal was not waived.
              </p>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            Save waiver settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
