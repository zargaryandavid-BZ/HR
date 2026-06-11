"use client";

import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameMonth,
  isToday,
  isWeekend,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn, formatLeaveBalanceHours, formatLeaveBalanceValue } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { EmployeeDashboardSection } from "./employee-dashboard-section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { formatStoredDateRange, parseStoredDateLocal } from "@/lib/dates";

type Balance = {
  id: string;
  leaveTypeId: string;
  leaveTypeName: string;
  slug?: string | null;
  isPaid: boolean;
  isAccrued?: boolean;
  allowance: number;
  usedDays: number;
  pendingDays: number;
  remaining: number;
  balanceHours?: number;
  accrualCapHours?: number | null;
  capPercent?: number | null;
  accrualHoursWorked?: number;
  hoursWorkedPerAccrual?: number;
  hoursEarnedPerAccrual?: number;
  ptoRolloverCapHours?: number | null;
  fullRollover?: boolean;
  canUseLeave?: boolean;
  daysUntilEligible?: number;
  eligibleDate?: string | null;
};

type LeaveReq = {
  id: string;
  leaveTypeName: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  workingDays: number;
  status: string;
};

type HistoryRequest = {
  id: string;
  policyId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  notes: string | null;
  rejectionReason: string | null;
  createdAt: string;
  submittedAt: string;
};

type Holiday = { id: string; name: string; date: string };

type LeaveData = {
  balances: Balance[];
  requests: LeaveReq[];
  holidays: Holiday[];
};

const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const STATUS_CHIP: Record<
  HistoryRequest["status"],
  { label: string; bg: string; text: string }
> = {
  PENDING: { label: "⏳ Pending", bg: "#FAEEDA", text: "#854F0B" },
  APPROVED: { label: "✓ Approved", bg: "#EAF3DE", text: "#3B6D11" },
  REJECTED: { label: "✗ Not approved", bg: "#FCEBEB", text: "#A32D2D" },
  CANCELLED: { label: "— Cancelled", bg: "#F1EFE8", text: "#5F5E5A" },
};

function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function formatDateRange(start: string, end: string): string {
  const startKey = start.slice(0, 10);
  const endKey = end.slice(0, 10);
  return formatStoredDateRange(startKey, endKey);
}

function StatusChip({ status }: { status: HistoryRequest["status"] }) {
  const chip = STATUS_CHIP[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: chip.bg, color: chip.text }}
    >
      {chip.label}
    </span>
  );
}

/** Section 1 — Leave & Sick Days: balance cards + holiday calendar + request modal */
export function EmployeeLeaveSection() {
  const queryClient = useQueryClient();
  const todayStr = toDateKey(new Date());
  const [month, setMonth] = useState(new Date());
  const [requestOpen, setRequestOpen] = useState(false);
  const [leaveRequestsOpen, setLeaveRequestsOpen] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [cancelErrors, setCancelErrors] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery<LeaveData>({
    queryKey: ["employee-leave"],
    queryFn: async () => {
      const res = await fetch("/api/employee/leave");
      const json = await res.json();
      return json.data;
    },
  });

  const { data: historyRequests, isLoading: historyLoading } = useQuery<HistoryRequest[]>({
    queryKey: ["employee-leave-requests"],
    queryFn: async () => {
      const res = await fetch("/api/employee/leave-requests");
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load requests");
      return json.data;
    },
  });

  const requestMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/employee/leave/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaveTypeId, startDate, endDate, notes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to submit request");
      return json.data as HistoryRequest;
    },
    onSuccess: (newRequest) => {
      queryClient.setQueryData<HistoryRequest[]>(["employee-leave-requests"], (prev) =>
        [newRequest, ...(prev ?? [])]
      );

      queryClient.setQueryData<LeaveData>(["employee-leave"], (prev) => {
        if (!prev) return prev;
        const calendarReq: LeaveReq = {
          id: newRequest.id,
          leaveTypeName: newRequest.leaveType,
          leaveTypeId: newRequest.policyId,
          startDate: newRequest.startDate,
          endDate: newRequest.endDate,
          workingDays: newRequest.days,
          status: "PENDING",
        };
        return {
          ...prev,
          requests: [calendarReq, ...prev.requests],
          balances: prev.balances.map((b) =>
            b.leaveTypeId === newRequest.policyId
              ? { ...b, pendingDays: b.pendingDays + newRequest.days, remaining: b.remaining - newRequest.days }
              : b
          ),
        };
      });

      setRequestOpen(false);
      setLeaveTypeId("");
      setStartDate("");
      setEndDate("");
      setNotes("");
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await fetch(`/api/employee/leave-requests/${requestId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Failed to cancel request");
      return requestId;
    },
    onSuccess: (requestId) => {
      queryClient.setQueryData<HistoryRequest[]>(["employee-leave-requests"], (prev) =>
        (prev ?? []).map((r) =>
          r.id === requestId ? { ...r, status: "CANCELLED" as const } : r
        )
      );

      queryClient.setQueryData<LeaveData>(["employee-leave"], (prev) => {
        if (!prev) return prev;
        const cancelled = prev.requests.find((r) => r.id === requestId);
        return {
          ...prev,
          requests: prev.requests.map((r) =>
            r.id === requestId ? { ...r, status: "CANCELLED" } : r
          ),
          balances: cancelled
            ? prev.balances.map((b) =>
                b.leaveTypeId === cancelled.leaveTypeId
                  ? {
                      ...b,
                      pendingDays: Math.max(0, b.pendingDays - cancelled.workingDays),
                      remaining: b.remaining + cancelled.workingDays,
                    }
                  : b
              )
            : prev.balances,
        };
      });

      setCancelConfirmId(null);
      setCancelErrors((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
    },
    onError: (e: Error, requestId) => {
      setCancelErrors((prev) => ({ ...prev, [requestId]: e.message }));
      setCancelConfirmId(null);
    },
  });

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart);

  const holidayDates = new Set((data?.holidays ?? []).map((h) => h.date.split("T")[0]));
  const approvedDates = new Set(
    (data?.requests ?? [])
      .filter((r) => r.status === "APPROVED")
      .flatMap((r) =>
        eachDayOfInterval({
          start: parseStoredDateLocal(r.startDate),
          end: parseStoredDateLocal(r.endDate),
        }).map(toDateKey)
      )
  );
  const pendingDates = new Set(
    (data?.requests ?? [])
      .filter((r) => r.status === "PENDING")
      .flatMap((r) =>
        eachDayOfInterval({
          start: parseStoredDateLocal(r.startDate),
          end: parseStoredDateLocal(r.endDate),
        }).map(toDateKey)
      )
  );

  const endBeforeStart = Boolean(startDate && endDate && endDate < startDate);
  const startIsPast = Boolean(startDate && startDate < todayStr);

  const workingDaysPreview = (() => {
    if (!startDate || !endDate || endBeforeStart || startIsPast) return 0;
    try {
      const days = eachDayOfInterval({
        start: parseStoredDateLocal(startDate),
        end: parseStoredDateLocal(endDate),
      });
      return days.filter((d) => !isWeekend(d) && !holidayDates.has(toDateKey(d))).length;
    } catch {
      return 0;
    }
  })();

  const selectedBalance = data?.balances.find((b) => b.leaveTypeId === leaveTypeId);
  const isUnpaidLeave = selectedBalance?.isPaid === false;
  const exceedsBalance =
    selectedBalance != null &&
    selectedBalance.isPaid &&
    workingDaysPreview > selectedBalance.remaining;

  function handleStartDateChange(value: string) {
    setStartDate(value);
    if (endDate && value && endDate < value) setEndDate("");
    setError(null);
  }

  function handleEndDateChange(value: string) {
    setEndDate(value);
    setError(null);
  }

  function handleRequestOpenChange(open: boolean) {
    setRequestOpen(open);
    if (!open) {
      setLeaveTypeId("");
      setStartDate("");
      setEndDate("");
      setNotes("");
      setError(null);
    }
  }

  function openRequestForType(typeId: string) {
    setLeaveTypeId(typeId);
    setStartDate("");
    setEndDate("");
    setNotes("");
    setError(null);
    setRequestOpen(true);
  }

  function requestButtonLabel(name: string): string {
    if (name === "Sick Leave") return "Request sick day";
    if (name === "Unpaid Leave") return "Request";
    return "Request leave";
  }

  function dayBg(day: Date): string {
    const key = toDateKey(day);
    if (isToday(day)) return "";
    if (holidayDates.has(key)) return "bg-blue-100";
    if (approvedDates.has(key)) return "bg-green-100";
    if (pendingDates.has(key)) return "bg-amber-100";
    return "";
  }

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <>
      <EmployeeDashboardSection title="Leave & Sick Days" defaultOpen={false} contentClassName="space-y-4">
        <div className="flex items-start justify-between gap-5 flex-wrap">
          <div className="flex-1 min-w-[240px] space-y-4">
            {data?.balances.map((b) => {
              const isSelected = requestOpen && leaveTypeId === b.leaveTypeId;
              const previewDays =
                isSelected && endDate && workingDaysPreview > 0 ? workingDaysPreview : 0;
              const usedTotal = b.usedDays + b.pendingDays + previewDays;
              const allowance = b.allowance;
              const usedPct =
                b.isPaid && allowance > 0 && !b.isAccrued
                  ? Math.min((usedTotal / allowance) * 100, 100)
                  : 0;
              const capPercent = b.capPercent ?? 0;
              const balanceHours = b.balanceHours ?? b.remaining * 8;
              const balanceDays = b.remaining;
              const eligibleLabel = b.eligibleDate
                ? format(parseISO(b.eligibleDate), "MMM d, yyyy")
                : null;

              if (b.isAccrued) {
                return (
                  <div
                    key={b.id}
                    className="rounded-lg border bg-muted/20 p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold">{b.leaveTypeName}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 shrink-0 text-xs"
                        disabled={b.canUseLeave === false}
                        onClick={() => openRequestForType(b.leaveTypeId)}
                      >
                        {requestButtonLabel(b.leaveTypeName)}
                      </Button>
                    </div>
                    <p className="text-sm">
                      Balance{" "}
                      <span className="font-bold">
                        {formatLeaveBalanceHours(balanceHours)} hrs
                      </span>{" "}
                      <span className="text-muted-foreground">
                        ({formatLeaveBalanceValue(balanceDays)} days)
                      </span>
                    </p>
                    {b.accrualCapHours != null && (
                      <>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-green-600 transition-all"
                            style={{ width: `${Math.min(capPercent, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {capPercent}% of {b.accrualCapHours}-hr cap
                        </p>
                      </>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Accruing: {b.hoursEarnedPerAccrual ?? 1} hr per{" "}
                      {b.hoursWorkedPerAccrual ?? 30} hrs worked
                    </p>
                    {b.ptoRolloverCapHours != null && (
                      <p className="text-xs text-muted-foreground">
                        Year-end rollover cap: {b.ptoRolloverCapHours} hrs
                      </p>
                    )}
                    {b.fullRollover && (
                      <p className="text-xs text-green-700">
                        Full rollover at year end (California)
                      </p>
                    )}
                    {b.canUseLeave === false && (
                      <p className="text-xs text-amber-700">
                        ⏳ Available to use in {b.daysUntilEligible} day
                        {b.daysUntilEligible !== 1 ? "s" : ""}
                        {eligibleLabel ? ` (eligible ${eligibleLabel})` : ""}
                        <br />
                        You&apos;re earning hours now — they&apos;ll be available after your{" "}
                        {90}-day period.
                      </p>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={b.id}
                  className={`space-y-1.5 ${isSelected && previewDays > 0 ? "rounded-lg ring-2 ring-primary/20 p-2 -m-2" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{b.leaveTypeName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {b.isPaid
                          ? `${formatLeaveBalanceValue(usedTotal)} of ${formatLeaveBalanceValue(allowance)} days used`
                          : `${formatLeaveBalanceValue(usedTotal)} unpaid day(s) used`}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-[7.75rem] shrink-0 justify-center text-xs"
                      onClick={() => openRequestForType(b.leaveTypeId)}
                    >
                      {requestButtonLabel(b.leaveTypeName)}
                    </Button>
                  </div>
                  {b.isPaid && allowance > 0 && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${usedPct}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            {data?.balances.length === 0 && (
              <p className="text-sm text-muted-foreground">No leave balances assigned.</p>
            )}
          </div>

          <div className="flex gap-3 shrink-0">
            <div className="w-[200px]">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setMonth((m) => subMonths(m, 1))}
                  className="p-1 rounded hover:bg-muted"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-medium">{format(month, "MMMM yyyy")}</span>
                <button
                  onClick={() => setMonth((m) => addMonths(m, 1))}
                  className="p-1 rounded hover:bg-muted"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-px text-center">
                {DAY_HEADERS.map((d) => (
                  <div key={d} className="text-[10px] font-medium text-muted-foreground py-1">
                    {d}
                  </div>
                ))}
                {Array.from({ length: startPadding }).map((_, i) => (
                  <div key={`pad-${i}`} />
                ))}
                {daysInMonth.map((day) => {
                  const bg = dayBg(day);
                  const today = isToday(day);
                  return (
                    <div
                      key={day.toISOString()}
                      className={`text-[11px] py-1 rounded-sm leading-tight ${
                        today
                          ? "bg-primary text-primary-foreground font-bold rounded-full"
                          : bg
                            ? bg
                            : isWeekend(day)
                              ? "text-muted-foreground"
                              : ""
                      } ${!isSameMonth(day, month) ? "opacity-0" : ""}`}
                    >
                      {format(day, "d")}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1.5 justify-center pt-6">
              {[
                { color: "bg-blue-100", label: "Holiday" },
                { color: "bg-green-100", label: "Approved" },
                { color: "bg-amber-100", label: "Pending" },
              ].map(({ color, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 text-[10px] text-muted-foreground whitespace-nowrap"
                >
                  <span className={`w-3 h-3 rounded-sm shrink-0 ${color}`} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <button
            type="button"
            onClick={() => setLeaveRequestsOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-2 text-left"
            aria-expanded={leaveRequestsOpen}
          >
            <h3 className="text-sm font-semibold">My Leave Requests</h3>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                leaveRequestsOpen && "rotate-180"
              )}
            />
          </button>

          {leaveRequestsOpen && (
          <div className="space-y-3 mt-3">
          {historyLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !historyRequests?.length ? (
            <p className="text-sm text-muted-foreground">No leave requests submitted yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Type</th>
                    <th className="pb-2 pr-4 font-medium">Dates</th>
                    <th className="pb-2 pr-4 font-medium">Days</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Submitted</th>
                    <th className="pb-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRequests.map((row) => (
                    <Fragment key={row.id}>
                      <tr className="border-b last:border-b-0">
                        <td className="py-3 pr-4 font-medium">{row.leaveType}</td>
                        <td className="py-3 pr-4 whitespace-nowrap">
                          {formatDateRange(row.startDate, row.endDate)}
                        </td>
                        <td className="py-3 pr-4">{row.days}</td>
                        <td className="py-3 pr-4">
                          <StatusChip status={row.status} />
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap">
                          {format(parseISO(row.submittedAt), "MMM d, yyyy")}
                        </td>
                        <td className="py-3">
                          {row.status === "PENDING" && cancelConfirmId !== row.id && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
                              onClick={() => {
                                setCancelConfirmId(row.id);
                                setCancelErrors((prev) => {
                                  const next = { ...prev };
                                  delete next[row.id];
                                  return next;
                                });
                              }}
                            >
                              Cancel
                            </Button>
                          )}
                          {row.status === "PENDING" && cancelConfirmId === row.id && (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-muted-foreground">Cancel this request?</span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs text-red-600 hover:text-red-700"
                                disabled={cancelMutation.isPending}
                                onClick={() => cancelMutation.mutate(row.id)}
                              >
                                Yes, cancel
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setCancelConfirmId(null)}
                              >
                                Keep it
                              </Button>
                            </div>
                          )}
                          {row.status !== "PENDING" && "—"}
                          {cancelErrors[row.id] && (
                            <p className="text-xs text-destructive mt-1">{cancelErrors[row.id]}</p>
                          )}
                        </td>
                      </tr>
                      {row.status === "REJECTED" && row.rejectionReason?.trim() && (
                        <tr>
                          <td colSpan={6} className="pb-3 pl-4">
                            <p className="text-xs text-muted-foreground">
                              ↳ Reason: &ldquo;{row.rejectionReason.trim()}&rdquo;
                            </p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>
          )}
        </div>
      </EmployeeDashboardSection>

      <Dialog open={requestOpen} onOpenChange={handleRequestOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Leave</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Leave type</Label>
              <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {data?.balances.map((b) => (
                    <SelectItem key={b.leaveTypeId} value={b.leaveTypeId}>
                      {b.isPaid
                        ? `${b.leaveTypeName} — ${formatLeaveBalanceValue(b.remaining)} days remaining`
                        : `${b.leaveTypeName} — unpaid`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start date</Label>
                <input
                  type="date"
                  min={todayStr}
                  className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                />
                {startIsPast && (
                  <p className="text-xs text-destructive">Start date cannot be in the past</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>End date</Label>
                <input
                  type="date"
                  min={startDate || todayStr}
                  className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                />
                {endBeforeStart && (
                  <p className="text-xs text-destructive">End date must be on or after start date</p>
                )}
              </div>
            </div>
            {startDate && endDate && !endBeforeStart && !startIsPast && selectedBalance && (
              <div className="space-y-1 text-sm">
                {workingDaysPreview > 0 ? (
                  <>
                    <p className={exceedsBalance ? "text-[#854F0B]" : "text-muted-foreground"}>
                      Requesting: {workingDaysPreview} day{workingDaysPreview !== 1 ? "s" : ""}
                      {selectedBalance.isPaid && (
                        <>
                          {" "}
                          · {selectedBalance.leaveTypeName} balance:{" "}
                          {formatLeaveBalanceValue(selectedBalance.remaining)} days remaining
                        </>
                      )}
                    </p>
                    {exceedsBalance && (
                      <p className="text-[#854F0B] text-sm">
                        ⚠ This exceeds your available {selectedBalance.leaveTypeName} balance.
                      </p>
                    )}
                    {isUnpaidLeave && (
                      <p className="text-muted-foreground">
                        Total unpaid leave after request:{" "}
                        <span className="font-medium">
                          {formatLeaveBalanceValue(
                            selectedBalance.usedDays +
                            selectedBalance.pendingDays +
                            workingDaysPreview
                          )}
                        </span>{" "}
                        day(s)
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-destructive">No working days in the selected range</p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes for your manager"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => requestMutation.mutate()}
              disabled={
                !leaveTypeId ||
                !startDate ||
                !endDate ||
                startIsPast ||
                endBeforeStart ||
                workingDaysPreview <= 0 ||
                requestMutation.isPending
              }
            >
              {requestMutation.isPending ? "Submitting…" : "Submit request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
