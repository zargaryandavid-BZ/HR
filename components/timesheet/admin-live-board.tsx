"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Users, UserX, Coffee, Download } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatElapsed } from "@/lib/time/hours-worked";
import { TimeEntryEditModal } from "./time-entry-edit-modal";

type LiveEmployee = {
  id: string;
  name: string;
  department: string | null;
  position: string | null;
  isClockedIn: boolean;
  isOnBreak: boolean;
  clockIn: string | null;
  elapsed: number;
};

type TimeEntryRow = {
  id: string;
  clockIn: string;
  clockOut: string | null;
  hoursWorked: number | null;
  status: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    department: { name: string } | null;
  };
  breaks?: Array<{ id: string; breakType: string; durationMin: number | null }>;
};

type RangeFilter = "today" | "week" | "month" | "custom";

function StatusDot({ isClockedIn, isOnBreak }: { isClockedIn: boolean; isOnBreak: boolean }) {
  if (isOnBreak) return <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" />;
  if (isClockedIn) return <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />;
  return <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400" />;
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case "APPROVED":
      return "success" as const;
    case "FLAGGED":
      return "warning" as const;
    case "IN_PROGRESS":
    case "ON_BREAK":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

export function AdminLiveBoard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<RangeFilter>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [editEntry, setEditEntry] = useState<TimeEntryRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addEmployeeId, setAddEmployeeId] = useState("");
  const [addClockIn, setAddClockIn] = useState("");
  const [addClockOut, setAddClockOut] = useState("");
  const [addReason, setAddReason] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [mergeResult, setMergeResult] = useState<string | null>(null);

  const { data: live = [] } = useQuery<LiveEmployee[]>({
    queryKey: ["admin-clock-live"],
    queryFn: async () => {
      const res = await fetch("/api/admin/clock/live");
      const json = await res.json();
      return json.data ?? [];
    },
    refetchInterval: 60_000,
  });

  const entriesQueryKey = ["admin-time-entries", range, customFrom, customTo];
  const { data: entries = [], isLoading: entriesLoading } = useQuery<TimeEntryRow[]>({
    queryKey: entriesQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ range });
      if (range === "custom" && customFrom && customTo) {
        params.set("from", customFrom);
        params.set("to", customTo);
      }
      const res = await fetch(`/api/admin/time-entries?${params}`);
      const json = await res.json();
      return json.data ?? [];
    },
    enabled: range !== "custom" || Boolean(customFrom && customTo),
  });

  const { data: employeesData } = useQuery({
    queryKey: ["employees-add-entry"],
    queryFn: async () => {
      const res = await fetch("/api/employees?limit=200&status=ACTIVE");
      const json = await res.json();
      return json.data?.employees ?? [];
    },
    enabled: addOpen,
  });

  function refreshEntries() {
    queryClient.invalidateQueries({ queryKey: ["admin-time-entries"] });
    queryClient.invalidateQueries({ queryKey: ["admin-clock-live"] });
  }

  function exportCsv() {
    const params = new URLSearchParams({ range });
    if (range === "custom" && customFrom && customTo) {
      params.set("from", customFrom);
      params.set("to", customTo);
    }
    window.location.href = `/api/admin/time-entries/export?${params.toString()}`;
  }

  async function mergeDuplicates() {
    setMergeLoading(true);
    setMergeResult(null);
    const res = await fetch("/api/admin/time-entries/merge", { method: "POST" });
    const json = await res.json();
    setMergeLoading(false);
    setMergeResult(json.message ?? "Done");
    refreshEntries();
    setTimeout(() => setMergeResult(null), 8_000);
  }

  async function approveEntry(id: string) {
    await fetch(`/api/admin/time-entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Approved by HR", status: "APPROVED" }),
    });
    refreshEntries();
  }

  async function flagEntry(id: string) {
    await fetch(`/api/admin/time-entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Flagged by HR", status: "FLAGGED" }),
    });
    refreshEntries();
  }

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!addEmployeeId || !addClockIn || !addReason.trim()) {
      setAddError("Employee, clock in, and reason are required");
      return;
    }
    setAddLoading(true);
    setAddError(null);
    const res = await fetch("/api/admin/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: addEmployeeId,
        clockIn: new Date(addClockIn).toISOString(),
        clockOut: addClockOut ? new Date(addClockOut).toISOString() : undefined,
        reason: addReason.trim(),
      }),
    });
    const json = await res.json();
    setAddLoading(false);
    if (!res.ok) {
      setAddError(json.message ?? "Failed to add entry");
      return;
    }
    setAddOpen(false);
    setAddEmployeeId("");
    setAddClockIn("");
    setAddClockOut("");
    setAddReason("");
    refreshEntries();
  }

  const clockedIn = live.filter((e) => e.isClockedIn && !e.isOnBreak).length;
  const onBreak = live.filter((e) => e.isOnBreak).length;
  const absent = live.filter((e) => !e.isClockedIn).length;

  return (
    <div>
      <PageHeader
        title="Timesheet"
        description="Live presence board and time entry management"
      />

      {/* Two-column layout: main entries table + right live sidebar */}
      <div className="flex gap-6 items-start">

        {/* ── Left / Main: Time Entries ───────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Time Entries</CardTitle>
              <div className="flex items-center gap-2">
                {mergeResult && (
                  <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
                    {mergeResult}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={mergeDuplicates}
                  disabled={mergeLoading}
                  title="Merge same-day duplicate entries per employee into one record"
                >
                  {mergeLoading ? "Merging…" : "Fix Duplicates"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={exportCsv}
                  title="Download time entries as CSV for payroll"
                  className="text-green-700 border-green-300 hover:bg-green-50"
                >
                  <Download className="h-4 w-4 mr-1" /> Export CSV
                </Button>
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Add Entry
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {(["today", "week", "month", "custom"] as RangeFilter[]).map((r) => (
                  <Button
                    key={r}
                    size="sm"
                    variant={range === r ? "default" : "outline"}
                    onClick={() => setRange(r)}
                  >
                    {r === "today" ? "Today" : r === "week" ? "Week" : r === "month" ? "Month" : "Custom"}
                  </Button>
                ))}
                {range === "custom" && (
                  <div className="flex items-center gap-2">
                    <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                    <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                  </div>
                )}
              </div>

              <DataTable>
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="px-4 py-2 font-medium">Employee</th>
                    <th className="px-4 py-2 font-medium">Clock In</th>
                    <th className="px-4 py-2 font-medium">Clock Out</th>
                    <th className="px-4 py-2 font-medium">Hours</th>
                    <th className="px-4 py-2 font-medium">Breaks</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entriesLoading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!entriesLoading &&
                    entries.map((entry) => (
                      <tr key={entry.id} className="border-b">
                        <td className="px-4 py-2">
                          {entry.employee.firstName} {entry.employee.lastName}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {format(new Date(entry.clockIn), "MMM d, h:mm a")}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {entry.clockOut
                            ? format(new Date(entry.clockOut), "MMM d, h:mm a")
                            : "—"}
                        </td>
                        <td className="px-4 py-2">
                          {entry.hoursWorked != null ? entry.hoursWorked.toFixed(2) : "—"}
                        </td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">
                          {entry.breaks?.length ?? 0}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant={statusBadgeVariant(entry.status)}>{entry.status}</Badge>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            {entry.status === "COMPLETED" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7"
                                onClick={() => approveEntry(entry.id)}
                              >
                                Approve
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7"
                              onClick={() => setEditEntry(entry)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7"
                              onClick={() => flagEntry(entry.id)}
                            >
                              Flag
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  {!entriesLoading && entries.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        No entries for this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </DataTable>
            </CardContent>
          </Card>
        </div>

        {/* ── Right Sidebar: Who's In Right Now ───────────────────────── */}
        <div className="w-72 shrink-0 sticky top-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Who&apos;s In Right Now</CardTitle>
              {/* Status summary chips */}
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs font-medium text-green-700">
                  <Users className="h-3 w-3" /> {clockedIn} in
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">
                  <Coffee className="h-3 w-3" /> {onBreak} break
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-medium text-red-700">
                  <UserX className="h-3 w-3" /> {absent} absent
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y max-h-[70vh] overflow-y-auto">
                {live.length === 0 && (
                  <p className="px-4 py-6 text-center text-xs text-muted-foreground">No active employees</p>
                )}
                {live.map((emp) => (
                  <button
                    key={emp.id}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors"
                    onClick={() => router.push(`/admin/employees/${emp.id}`)}
                  >
                    <StatusDot isClockedIn={emp.isClockedIn} isOnBreak={emp.isOnBreak} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{emp.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {emp.department ?? emp.position ?? "—"}
                      </p>
                    </div>
                    {emp.isClockedIn && (
                      <span className="text-xs font-mono text-muted-foreground shrink-0">
                        {formatElapsed(emp.elapsed)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

      {editEntry && (
        <TimeEntryEditModal
          entryId={editEntry.id}
          clockIn={editEntry.clockIn}
          clockOut={editEntry.clockOut}
          open={!!editEntry}
          onClose={() => setEditEntry(null)}
          onSaved={refreshEntries}
        />
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Time Entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddEntry} className="space-y-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={addEmployeeId}
                onChange={(e) => setAddEmployeeId(e.target.value)}
              >
                <option value="">Select employee</option>
                {(employeesData ?? []).map(
                  (emp: { id: string; firstName: string; lastName: string }) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName}
                    </option>
                  )
                )}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Clock In</Label>
              <Input
                type="datetime-local"
                value={addClockIn}
                onChange={(e) => setAddClockIn(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Clock Out (optional)</Label>
              <Input
                type="datetime-local"
                value={addClockOut}
                onChange={(e) => setAddClockOut(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={addReason}
                onChange={(e) => setAddReason(e.target.value)}
                rows={3}
                placeholder="Required"
              />
            </div>
            {addError && <p className="text-sm text-destructive">{addError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addLoading}>
                {addLoading ? "Adding…" : "Add Entry"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
