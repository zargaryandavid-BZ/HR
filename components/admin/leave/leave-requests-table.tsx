"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatStoredDateRange } from "@/lib/dates";
import { cn, formatLeaveBalanceValue } from "@/lib/utils";
import { Check, X, Undo2, ChevronUp, ChevronDown } from "lucide-react";
import { EmptyState } from "@/components/shared/page-header";
import { toast } from "sonner";

type LeaveRequest = {
  id: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    department: { name: string } | null;
    positionName: string | null;
    managerName: string | null;
    avatarInitials: string;
  };
  policy: { id: string; name: string };
  startDate: string;
  endDate: string;
  workingDays: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  note: string | null;
  reviewNote: string | null;
  createdAt: string;
  balance: { totalDays: number; usedDays: number; remainingDays: number };
};

type SortKey = "employee" | "workingDays" | "status" | "createdAt";
type SortDir = "asc" | "desc";

const POLICY_COLORS: Record<string, string> = {
  PTO: "bg-blue-100 text-blue-700 border-blue-200",
  "Sick Leave": "bg-pink-100 text-pink-700 border-pink-200",
  Personal: "bg-purple-100 text-purple-700 border-purple-200",
};

const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-amber-500",
  "bg-cyan-500",
];

function getAvatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function BalanceBar({ total, used }: { total: number; used: number }) {
  const pct = total > 0 ? (used / total) * 100 : 0;
  const color = pct < 50 ? "bg-green-500" : pct < 80 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">
        {formatLeaveBalanceValue(used)} of {formatLeaveBalanceValue(total)} used
      </p>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: LeaveRequest["status"] }) {
  const map = {
    PENDING: "bg-amber-100 text-amber-700 border-amber-200",
    APPROVED: "bg-green-100 text-green-700 border-green-200",
    REJECTED: "bg-red-100 text-red-700 border-red-200",
    CANCELLED: "bg-gray-100 text-gray-600 border-gray-200",
  };
  const labels = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected", CANCELLED: "Cancelled" };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border", map[status])}>
      {labels[status]}
    </span>
  );
}

function RejectPopover({
  onConfirm,
  onCancel,
  isLoading,
}: {
  onConfirm: (note: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function handleConfirm() {
    if (!note.trim()) {
      setError("Reason for rejection is required");
      return;
    }
    setError("");
    onConfirm(note.trim());
  }

  return (
    <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-lg border bg-card p-3 shadow-lg">
      <p className="text-xs font-medium mb-1.5">Reason for rejection (required)</p>
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        className="text-sm resize-none"
        placeholder="Enter reason..."
      />
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      <div className="flex items-center gap-2 mt-2">
        <Button size="sm" variant="destructive" onClick={handleConfirm} disabled={isLoading} className="flex-1">
          {isLoading ? "Rejecting…" : "Confirm Reject"}
        </Button>
        <button onClick={onCancel} className="text-xs text-muted-foreground hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}

type Props = {
  statusFilter: string;
  leaveTypeId?: string;
  departmentId?: string;
  period?: string;
  search?: string;
  page: number;
  onPageChange: (p: number) => void;
  onStatsRefresh: () => void;
};

const LIMIT = 20;

/** Full-width responsive column layout for leave request rows */
const TABLE_GRID =
  "w-full grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.6fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_175px]";

/** Main leave requests table with sorting, inline approve/reject, and pagination */
export function LeaveRequestsTable({
  statusFilter,
  leaveTypeId,
  departmentId,
  period,
  search,
  page,
  onPageChange,
  onStatsRefresh,
}: Props) {
  const queryClient = useQueryClient();
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const queryParams = new URLSearchParams({
    ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
    ...(leaveTypeId ? { leaveTypeId } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(period ? { period } : {}),
    ...(search ? { search } : {}),
    page: String(page),
    limit: String(LIMIT),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["leave-requests", statusFilter, leaveTypeId, departmentId, period, search, page],
    queryFn: async () => {
      const res = await fetch(`/api/leave/requests?${queryParams}`);
      const json = await res.json();
      return json.data as { requests: LeaveRequest[]; total: number };
    },
    staleTime: 10_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
    onStatsRefresh();
  };

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/leave/requests/${id}/approve`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (!res.ok) { const j = await res.json(); throw new Error(j.message ?? "Failed"); }
    },
    onSuccess: () => { toast.success("Leave request approved"); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reviewNote }: { id: string; reviewNote: string }) => {
      const res = await fetch(`/api/leave/requests/${id}/reject`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reviewNote }) });
      if (!res.ok) { const j = await res.json(); throw new Error(j.message ?? "Failed"); }
    },
    onSuccess: () => { toast.success("Leave request rejected"); setRejectingId(null); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const undoMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/leave/requests/${id}/undo`, { method: "PATCH", headers: { "Content-Type": "application/json" } });
      if (!res.ok) { const j = await res.json(); throw new Error(j.message ?? "Failed"); }
    },
    onSuccess: () => { toast.success("Approval undone"); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const requests = data?.requests ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  const sorted = [...requests].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "employee") cmp = `${a.employee.lastName}${a.employee.firstName}`.localeCompare(`${b.employee.lastName}${b.employee.firstName}`);
    else if (sortKey === "workingDays") cmp = a.workingDays - b.workingDays;
    else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
    else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return sortDir === "asc" ? cmp : -cmp;
  });

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  }

  function ColHeader({ label, col }: { label: string; col: SortKey }) {
    return (
      <button onClick={() => handleSort(col)} className="flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground hover:text-foreground">
        {label} <SortIcon col={col} />
      </button>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!sorted.length) {
    return (
      <EmptyState
        title={statusFilter === "PENDING" ? "All caught up! No pending requests." : "No requests match your filters."}
        description={statusFilter !== "PENDING" ? "Try adjusting your filters." : undefined}
      />
    );
  }

  return (
    <div className="space-y-3 w-full">
      {/* Table header */}
      <div
        className={cn(
          "hidden lg:grid gap-3 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground",
          TABLE_GRID
        )}
      >
        <ColHeader label="Employee" col="employee" />
        <span>Position</span>
        <span>Manager</span>
        <span>Leave Type</span>
        <span>Date Range</span>
        <ColHeader label="Days" col="workingDays" />
        <span>Balance</span>
        <ColHeader label="Status" col="status" />
        <ColHeader label="Submitted" col="createdAt" />
        <span className="text-right">Actions</span>
      </div>

      {sorted.map((req) => {
        const policyColor = POLICY_COLORS[req.policy.name] ?? "bg-gray-100 text-gray-700 border-gray-200";
        const avatarColor = getAvatarColor(req.employee.id);
        const startPast = new Date(req.startDate) <= new Date();

        const formattedRange = formatStoredDateRange(
          req.startDate.slice(0, 10),
          req.endDate.slice(0, 10)
        );

        const submittedDate = new Date(req.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

        return (
          <div
            key={req.id}
            className={cn(
              "rounded-lg border bg-card p-3 lg:grid lg:items-center gap-3",
              TABLE_GRID
            )}
          >
            {/* Employee */}
            <div className="flex items-center gap-2 min-w-0">
              <div className={cn("h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-white text-xs font-semibold", avatarColor)}>
                {req.employee.avatarInitials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{req.employee.firstName} {req.employee.lastName}</p>
                {req.employee.department && (
                  <p className="text-[10px] text-muted-foreground truncate">{req.employee.department.name}</p>
                )}
              </div>
            </div>

            {/* Position */}
            <p className="text-sm truncate">{req.employee.positionName ?? "—"}</p>

            {/* Manager */}
            <p className="text-sm truncate">{req.employee.managerName ?? "—"}</p>

            {/* Leave Type */}
            <Badge variant="outline" className={cn("text-xs border", policyColor)}>
              {req.policy.name}
            </Badge>

            {/* Date Range */}
            <div className="min-w-0">
              <p className="text-sm">{formattedRange}</p>
              {req.note && (
                <p className="text-[10px] text-muted-foreground truncate">{req.note}</p>
              )}
            </div>

            {/* Days */}
            <div>
              <span className="text-sm font-bold">{req.workingDays}</span>
              <span className="text-xs text-muted-foreground"> {req.workingDays === 1 ? "day" : "days"}</span>
            </div>

            {/* Balance */}
            <BalanceBar total={req.balance.totalDays} used={req.balance.usedDays} />

            {/* Status */}
            <StatusChip status={req.status} />

            {/* Submitted */}
            <p className="text-xs text-muted-foreground">{submittedDate}</p>

            {/* Actions */}
            <div className="flex items-center justify-end gap-1.5 relative">
              {req.status === "PENDING" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-600 border-green-300 hover:bg-green-50 h-7 text-xs w-[82px] justify-center shrink-0"
                    onClick={() => approveMutation.mutate(req.id)}
                    disabled={approveMutation.isPending}
                  >
                    <Check className="h-3 w-3 mr-1" /> Approve
                  </Button>
                  <div className="relative shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-300 hover:bg-red-50 h-7 text-xs w-[82px] justify-center"
                      onClick={() => setRejectingId(rejectingId === req.id ? null : req.id)}
                    >
                      <X className="h-3 w-3 mr-1" /> Reject
                    </Button>
                    {rejectingId === req.id && (
                      <RejectPopover
                        onConfirm={(note) => rejectMutation.mutate({ id: req.id, reviewNote: note })}
                        onCancel={() => setRejectingId(null)}
                        isLoading={rejectMutation.isPending}
                      />
                    )}
                  </div>
                </>
              )}
              {req.status === "APPROVED" && !startPast && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => undoMutation.mutate(req.id)}
                  disabled={undoMutation.isPending}
                >
                  <Undo2 className="h-3 w-3 mr-1" /> Undo
                </Button>
              )}
            </div>
          </div>
        );
      })}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
          <span>
            Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
