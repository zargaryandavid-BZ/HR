"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CountBadge,
  DashboardEmptyState,
  DashboardPanel,
  EmployeeAvatar,
} from "@/components/admin/dashboard/dashboard-panel";
import {
  formatShortDateRange,
  getAvatarColor,
} from "@/lib/admin/dashboard-utils";
import type { AdminDashboardData } from "@/lib/admin/dashboard-data";

type PendingLeaveCardProps = {
  requests: AdminDashboardData["pendingLeaveRequests"];
  totalPending: number;
};

/** Pending leave requests with inline approve/reject actions */
export function PendingLeaveRequestsCard({
  requests: initialRequests,
  totalPending,
}: PendingLeaveCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [requests, setRequests] = useState(initialRequests);
  const [pendingCount, setPendingCount] = useState(totalPending);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleApprove(requestId: string, employeeName: string) {
    setLoadingId(requestId);
    try {
      const res = await fetch(`/api/leave/requests/${requestId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to approve");

      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setPendingCount((count) => Math.max(0, count - 1));
      toast.success(`Leave approved — notification sent to ${employeeName}.`);
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard-kpis"] });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleReject(requestId: string) {
    if (!rejectNote.trim()) {
      setRejectError("Reason for rejection is required");
      return;
    }

    setLoadingId(requestId);
    setRejectError("");
    try {
      const res = await fetch(`/api/leave/requests/${requestId}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNote: rejectNote.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to reject");

      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setPendingCount((count) => Math.max(0, count - 1));
      setRejectingId(null);
      setRejectNote("");
      toast.error("Leave rejected.");
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard-kpis"] });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reject");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <DashboardPanel
      title="Pending leave requests"
      badge={
        pendingCount > 0 ? (
          <CountBadge
            count={pendingCount}
            label="pending"
            className="border-amber-200 bg-amber-50 text-amber-700"
          />
        ) : undefined
      }
    >
      {requests.length === 0 ? (
        <DashboardEmptyState
          message="No pending leave requests."
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
        />
      ) : (
        <div className="divide-y">
          {requests.map((request) => {
            const employeeName = `${request.firstName} ${request.lastName}`;
            const avatarColor = getAvatarColor(request.employeeId);
            const isRejecting = rejectingId === request.id;
            const isLoading = loadingId === request.id;

            return (
              <div key={request.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <EmployeeAvatar
                    employeeId={request.employeeId}
                    firstName={request.firstName}
                    lastName={request.lastName}
                    colorClass={avatarColor}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{employeeName}</p>
                      {!isRejecting && (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs text-green-700 border-green-200 hover:bg-green-50"
                            disabled={isLoading}
                            onClick={() => handleApprove(request.id, employeeName)}
                          >
                            <Check className="mr-1 h-3 w-3" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs text-red-700 border-red-200 hover:bg-red-50"
                            disabled={isLoading}
                            onClick={() => {
                              setRejectingId(request.id);
                              setRejectNote("");
                              setRejectError("");
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {request.policyName} ·{" "}
                      {formatShortDateRange(request.startDate, request.endDate)} ·{" "}
                      {request.workingDays} day
                      {request.workingDays !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {isRejecting && (
                  <div className="mt-3 rounded-lg border bg-muted/30 p-3">
                    <p className="mb-1.5 text-xs font-medium">
                      Reason for rejection (required)
                    </p>
                    <Textarea
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      rows={2}
                      className="resize-none text-sm"
                      placeholder="Enter reason..."
                    />
                    {rejectError && (
                      <p className="mt-1 text-xs text-destructive">{rejectError}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isLoading}
                        onClick={() => handleReject(request.id)}
                      >
                        {isLoading ? "Rejecting…" : "Confirm Reject"}
                      </Button>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:underline"
                        onClick={() => {
                          setRejectingId(null);
                          setRejectNote("");
                          setRejectError("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DashboardPanel>
  );
}
