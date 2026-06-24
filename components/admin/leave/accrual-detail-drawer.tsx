"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn, formatLeaveBalanceHours, formatLeaveBalanceValue } from "@/lib/utils";
import { ManualAdjustmentModal } from "@/components/admin/leave/manual-adjustment-modal";

type AccrualBalance = {
  leaveTypeId: string;
  leaveTypeName: string;
  slug: "pto" | "sick";
  balanceHours: number;
  balanceDays: number;
  accrualCapHours: number;
  capPercent: number;
  accrualHoursEarned: number;
  accrualHoursWorked: number;
  usedDays: number;
  usedHours: number;
  hoursWorkedPerAccrual: number;
  hoursEarnedPerAccrual: number;
  hoursToNextAccrual: number;
  rolloverCapHours: number | null;
  fullRollover: boolean;
};

type AccrualDetail = {
  employee: { id: string; firstName: string; lastName: string };
  eligibility: {
    canUseLeave: boolean;
    daysUntilEligible: number;
    eligibleDate: string;
    waitDays: number;
  };
  balances: AccrualBalance[];
};

type Props = {
  employeeId: string | null;
  employeeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
};

function CapBar({ percent }: { percent: number }) {
  const color =
    percent >= 80 ? "bg-red-500" : percent >= 50 ? "bg-amber-500" : "bg-green-600";
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

/** Drawer showing PTO/sick accrual breakdown for one employee */
export function AccrualDetailDrawer({
  employeeId,
  employeeName,
  open,
  onOpenChange,
  onRefresh,
}: Props) {
  const [adjustTarget, setAdjustTarget] = useState<AccrualBalance | null>(null);
  const [logLeaveTypeId, setLogLeaveTypeId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<AccrualDetail>({
    queryKey: ["accrual-detail", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/leave-balances/accrual`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load");
      return json.data;
    },
    enabled: open && !!employeeId,
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["accrual-log", employeeId, logLeaveTypeId],
    queryFn: async () => {
      const params = logLeaveTypeId ? `?leaveTypeId=${logLeaveTypeId}` : "";
      const res = await fetch(
        `/api/employees/${employeeId}/leave-balances/accrual-log${params}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load log");
      return json.data as Array<{
        id: string;
        type: string;
        leaveTypeName: string;
        hoursWorked: number | null;
        hoursEarned: number;
        balanceAfter: number;
        note: string | null;
        createdAt: string;
      }>;
    },
    enabled: open && !!employeeId && !!logLeaveTypeId,
  });

  function handleRefresh() {
    refetch();
    onRefresh();
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader className="mb-4">
            <SheetTitle>Accrual Detail — {employeeName}</SheetTitle>
          </SheetHeader>

          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !data ? (
            <p className="text-sm text-muted-foreground">No accrual data available.</p>
          ) : (
            <div className="space-y-6">
              <div className="rounded-lg border p-3 text-sm">
                {data.eligibility.canUseLeave ? (
                  <p className="text-green-700">
                    ✅ Can use leave (hired &gt; {data.eligibility.waitDays} days ago)
                  </p>
                ) : (
                  <p className="text-amber-700">
                    ⏳ Eligible in {data.eligibility.daysUntilEligible} day
                    {data.eligibility.daysUntilEligible !== 1 ? "s" : ""} (
                    {formatDisplayDate(data.eligibility.eligibleDate)})
                  </p>
                )}
              </div>

              {data.balances.map((balance) => (
                <div key={balance.leaveTypeId} className="rounded-lg border p-4 space-y-3">
                  <h3 className="font-semibold text-sm">
                    {data.employee.firstName} {data.employee.lastName} — {balance.leaveTypeName}
                  </h3>

                  <div>
                    <p className="text-sm">
                      Current balance{" "}
                      <span className="font-bold">
                        {formatLeaveBalanceHours(balance.balanceHours)} hrs
                      </span>{" "}
                      <span className="text-muted-foreground">
                        ({formatLeaveBalanceValue(balance.balanceDays)} days)
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Accrual cap {balance.accrualCapHours} hrs
                    </p>
                    <CapBar percent={balance.capPercent} />
                    <p className="text-xs text-muted-foreground mt-1">
                      {balance.capPercent}% of cap
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>Earned (tracked): {formatLeaveBalanceHours(balance.accrualHoursEarned)} hrs</span>
                    <span>Used this year: {formatLeaveBalanceHours(balance.usedHours)} hrs</span>
                    <span className="col-span-2">
                      Total hours worked: {formatLeaveBalanceHours(balance.accrualHoursWorked)} hrs
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Next accrual: earns {balance.hoursEarnedPerAccrual} hr per{" "}
                    {balance.hoursWorkedPerAccrual} hrs worked · ~
                    {formatLeaveBalanceHours(balance.hoursToNextAccrual)} hrs to next full hour
                  </p>

                  {balance.slug === "pto" && balance.rolloverCapHours !== null && (
                    <p className="text-xs text-muted-foreground">
                      Year-end rollover cap: {balance.rolloverCapHours} hrs (excess forfeited Jan 1)
                    </p>
                  )}
                  {balance.fullRollover && (
                    <p className="text-xs text-green-700">
                      Full rollover at year end ✓
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAdjustTarget(balance)}
                    >
                      + Manual Adjustment
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setLogLeaveTypeId(
                          logLeaveTypeId === balance.leaveTypeId
                            ? null
                            : balance.leaveTypeId
                        )
                      }
                    >
                      {logLeaveTypeId === balance.leaveTypeId
                        ? "Hide accrual log"
                        : "View accrual log"}
                    </Button>
                  </div>

                  {logLeaveTypeId === balance.leaveTypeId && (
                    <div className="rounded-md border bg-muted/30 p-3 max-h-48 overflow-y-auto">
                      {logsLoading ? (
                        <Skeleton className="h-16 w-full" />
                      ) : !logs?.length ? (
                        <p className="text-xs text-muted-foreground">No log entries yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {logs.map((log) => (
                            <li key={log.id} className="text-xs border-b pb-2 last:border-0">
                              <div className="flex justify-between gap-2">
                                <span className="font-medium">{log.type}</span>
                                <span className="text-muted-foreground">
                                  {formatDisplayDateTime(log.createdAt)}
                                </span>
                              </div>
                              <p>
                                {log.hoursEarned >= 0 ? "+" : ""}
                                {formatLeaveBalanceHours(log.hoursEarned)} hrs → {formatLeaveBalanceHours(log.balanceAfter)} hrs
                              </p>
                              {log.note && (
                                <p className="text-muted-foreground">{log.note}</p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {adjustTarget && employeeId && (
        <ManualAdjustmentModal
          employeeId={employeeId}
          employeeName={employeeName}
          leaveTypeId={adjustTarget.leaveTypeId}
          leaveTypeName={adjustTarget.leaveTypeName}
          currentBalanceHours={adjustTarget.balanceHours}
          open={!!adjustTarget}
          onOpenChange={(o) => !o && setAdjustTarget(null)}
          onSuccess={handleRefresh}
        />
      )}
    </>
  );
}
