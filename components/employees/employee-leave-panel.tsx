"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorMessage } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { cn, formatLeaveBalanceValue } from "@/lib/utils";

type LeaveBalanceRow = {
  leaveTypeId: string;
  name: string;
  defaultDays: number;
  isPaid: boolean;
  balanceId: string | null;
  allowance: number;
  usedDays: number;
  pendingDays: number;
};

type EmployeeLeavePanelProps = {
  employeeId: string;
  onSuccess?: (message: string) => void;
};

/** Employee leave balances editor for the Leave tab */
export function EmployeeLeavePanel({ employeeId, onSuccess }: EmployeeLeavePanelProps) {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [allowances, setAllowances] = useState<Record<string, number>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!data?.balances) return;
    setAllowances(
      Object.fromEntries(data.balances.map((row) => [row.leaveTypeId, row.allowance]))
    );
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!data?.balances.length) {
        throw new Error("No leave types configured");
      }

      const res = await fetch(`/api/employees/${employeeId}/leave-balances`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: currentYear,
          balances: data.balances.map((row) => ({
            leaveTypeId: row.leaveTypeId,
            allowance: allowances[row.leaveTypeId] ?? row.allowance,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? json.message ?? "Failed to save leave balances");
      }
    },
    onSuccess: async () => {
      setSubmitError(null);
      await queryClient.invalidateQueries({
        queryKey: ["employee-leave-balances", employeeId, currentYear],
      });
      onSuccess?.("Leave balances saved");
    },
    onError: (error: Error) => {
      setSubmitError(error.message);
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
        <CardTitle className="text-base">Leave Balances ({currentYear})</CardTitle>
        <Button
          type="button"
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? "Saving..." : "Save"}
        </Button>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {submitError && <ErrorMessage message={submitError} />}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {data.balances.map((row) => {
            const allowance = allowances[row.leaveTypeId] ?? row.allowance;
            const remaining = allowance - row.usedDays - row.pendingDays;
            const usedPct =
              allowance > 0
                ? Math.min(((row.usedDays + row.pendingDays) / allowance) * 100, 100)
                : 0;

            return (
              <div key={row.leaveTypeId} className="rounded-lg border px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold truncate">{row.name}</p>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 shrink-0 font-normal"
                  >
                    {row.isPaid ? "Paid" : "Unpaid"}
                  </Badge>
                </div>

                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-2xl font-bold leading-none tabular-nums",
                        remaining < 0 && "text-destructive"
                      )}
                    >
                      {formatLeaveBalanceValue(remaining)}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">days left</p>
                  </div>
                  <div className="shrink-0 w-[72px]">
                    <label
                      htmlFor={`allowance-${row.leaveTypeId}`}
                      className="text-[11px] text-muted-foreground"
                    >
                      Allowance
                    </label>
                    <Input
                      id={`allowance-${row.leaveTypeId}`}
                      type="number"
                      min={0}
                      step={0.5}
                      className="h-8 mt-0.5 text-sm px-2"
                      value={allowance}
                      onChange={(e) =>
                        setAllowances((prev) => ({
                          ...prev,
                          [row.leaveTypeId]: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground leading-tight">
                  Used {formatLeaveBalanceValue(row.usedDays)} · Pending {formatLeaveBalanceValue(row.pendingDays)}
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
