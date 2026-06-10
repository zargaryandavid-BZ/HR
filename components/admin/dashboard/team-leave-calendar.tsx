import Link from "next/link";
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isToday,
  parse,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DashboardEmptyState, DashboardPanel } from "@/components/admin/dashboard/dashboard-panel";
import { formatShortDateRange } from "@/lib/admin/dashboard-utils";
import { cn } from "@/lib/utils";
import type { AdminDashboardData } from "@/lib/admin/dashboard-data";

type TeamLeaveCalendarProps = {
  leaveRequests: AdminDashboardData["leaveThisMonth"];
  viewMonth: string;
  viewMonthLabel: string;
};

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** Mini leave calendar with month navigation and who-is-out list */
export function TeamLeaveCalendar({
  leaveRequests,
  viewMonth,
  viewMonthLabel,
}: TeamLeaveCalendarProps) {
  const monthDate = parse(`${viewMonth}-01`, "yyyy-MM-dd", new Date());
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart);

  const prevMonth = format(
    new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1),
    "yyyy-MM"
  );
  const nextMonth = format(
    new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1),
    "yyyy-MM"
  );

  function isDayInLeaveRange(day: Date, start: Date, end: Date): boolean {
    const dayTime = startOfDay(day).getTime();
    return (
      dayTime >= startOfDay(start).getTime() &&
      dayTime <= startOfDay(end).getTime()
    );
  }

  function dayLeaveStatus(day: Date): "approved" | "pending" | null {
    const covering = leaveRequests.filter((request) =>
      isDayInLeaveRange(day, request.startDate, request.endDate)
    );
    if (covering.some((r) => r.status === "PENDING")) return "pending";
    if (covering.some((r) => r.status === "APPROVED")) return "approved";
    return null;
  }

  function dayCellClass(day: Date): string {
    if (isToday(day)) {
      return "bg-[#185FA5] font-bold text-white";
    }
    const status = dayLeaveStatus(day);
    if (status === "approved") {
      return "bg-[#EAF3DE] font-bold text-[#3B6D11]";
    }
    if (status === "pending") {
      return "bg-[#FAEEDA] font-bold text-[#854F0B]";
    }
    return "text-muted-foreground";
  }

  return (
    <DashboardPanel title="Team leave calendar" className="h-full">
      <div className="px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <Link
            href={`/admin/dashboard?month=${prevMonth}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border hover:bg-muted"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <p className="text-sm font-semibold">{viewMonthLabel}</p>
          <Link
            href={`/admin/dashboard?month=${nextMonth}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border hover:bg-muted"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: startPadding }).map((_, index) => (
            <div key={`pad-${index}`} />
          ))}
          {daysInMonth.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                "flex h-8 items-center justify-center rounded-md text-xs",
                dayCellClass(day)
              )}
            >
              {format(day, "d")}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t" />

      <div className="max-h-[280px] overflow-y-auto">
        {leaveRequests.length === 0 ? (
          <DashboardEmptyState message="No leave scheduled this month." />
        ) : (
          <div className="divide-y">
            {leaveRequests.map((request) => {
              const isApproved = request.status === "APPROVED";
              return (
                <Link
                  key={request.id}
                  href={`/admin/employees/${request.employeeId}?tab=leave`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40"
                >
                  <span
                    className={cn(
                      "w-[88px] shrink-0 text-xs font-medium",
                      isApproved ? "text-[#3B6D11]" : "text-[#854F0B]"
                    )}
                  >
                    {formatShortDateRange(request.startDate, request.endDate)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold">
                      {request.firstName} {request.lastName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {request.leaveTypeName}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      isApproved
                        ? "border-green-200 bg-green-100 text-green-700"
                        : "border-amber-200 bg-amber-100 text-amber-700"
                    )}
                  >
                    {isApproved ? "Approved" : "Pending"}
                  </span>
                  <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">
                    {request.workingDays}d
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 border-t px-4 py-2.5 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#EAF3DE] border border-[#3B6D11]/20" />
          Approved
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#FAEEDA] border border-[#854F0B]/20" />
          Pending approval
        </span>
      </div>
    </DashboardPanel>
  );
}
