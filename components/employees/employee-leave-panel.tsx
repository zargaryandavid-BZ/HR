"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorMessage } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { cn, formatLeaveBalanceHours, formatLeaveBalanceValue } from "@/lib/utils";
import { HOURS_PER_WORK_DAY } from "@/lib/accrual/constants";

type LeaveBalanceRow = {
  leaveTypeId: string;
  name: string;
  slug: string | null;
  isAccrued: boolean;
  defaultDays: number;
  isPaid: boolean;
  balanceId: string | null;
  allowance: number;
  balanceHours: number;
  usedDays: number;
  pendingDays: number;
  usedHours: number;
  pendingHours: number;
  remainingDays: number;
  remainingHours: number | null;
};

type EmployeeLeavePanelProps = {
  employeeId: string;
  onAddLeave?: () => void;
};

/** Read-only leave balances for the employee Leave tab */
export function EmployeeLeavePanel({ employeeId, onAddLeave }: EmployeeLeavePanelProps) {
  const currentYear = new Date().getFullYear();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["employee-leave-balances", employeeId, currentYear],
    queryFn: async () => {
      const res = await fetch(
        `/api/employees/${employeeId}/leave-balances?year=${currentYear}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load leave balances");
      return json.data as { year: number; balances: LeaveBalanceRow[] };
    },
  });

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (isError) {
    return <ErrorMessage message="Failed to load leave balances" />;
  }

  if (!data?.balances.length) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Leave Balances ({currentYear})</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            No leave types configured yet. Add leave types under Settings first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">Leave Balances ({currentYear})</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            PTO and sick leave accrue from hours worked. Use Add leave to record time off.
          </p>
        </div>
        {onAddLeave && (
          <Button type="button" size="sm" variant="outline" onClick={onAddLeave}>
            Add leave
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {data.balances.map((row) => {
            const accrued = row.isAccrued;
            const remainingHrs = row.remainingHours ?? 0;
            const remaining = accrued ? row.remainingDays : row.remainingDays;
            const totalPool = accrued ? row.balanceHours : row.allowance;
            const reserved = accrued
              ? row.usedHours + row.pendingHours
              : row.usedDays + row.pendingDays;
            const usedPct =
              totalPool > 0 ? Math.min((reserved / totalPool) * 100, 100) : 0;

            return (
              <div key={row.leaveTypeId} className="rounded-lg border px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold truncate">{row.name}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    {accrued && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                        Auto
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 font-normal"
                    >
                      {row.isPaid ? "Paid" : "Unpaid"}
                    </Badge>
                  </div>
                </div>

                <div>
                  {accrued ? (
                    <>
                      <p
                        className={cn(
                          "text-2xl font-bold leading-none tabular-nums",
                          remainingHrs < 0 && "text-destructive"
                        )}
                      >
                        {formatLeaveBalanceHours(remainingHrs)}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        hrs available ({formatLeaveBalanceValue(remaining)} days)
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Accrued {formatLeaveBalanceHours(row.balanceHours)} hrs total
                      </p>
                    </>
                  ) : (
                    <>
                      <p
                        className={cn(
                          "text-2xl font-bold leading-none tabular-nums",
                          remaining < 0 && "text-destructive"
                        )}
                      >
                        {formatLeaveBalanceValue(remaining)}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        days available of {formatLeaveBalanceValue(row.allowance)}
                      </p>
                    </>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground leading-tight">
                  {accrued ? (
                    <>
                      Used {formatLeaveBalanceHours(row.usedHours)} · Pending{" "}
                      {formatLeaveBalanceHours(row.pendingHours)}
                    </>
                  ) : (
                    <>
                      Used {formatLeaveBalanceValue(row.usedDays)} · Pending{" "}
                      {formatLeaveBalanceValue(row.pendingDays)}
                    </>
                  )}
                </p>

                <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      usedPct >= 90 ? "bg-red-500" : usedPct >= 70 ? "bg-amber-500" : "bg-primary"
                    )}
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
