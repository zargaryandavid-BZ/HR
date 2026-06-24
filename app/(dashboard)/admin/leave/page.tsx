"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { LeaveStatsCards } from "@/components/admin/leave/leave-stats-cards";
import { LeaveRequestsTable } from "@/components/admin/leave/leave-requests-table";
import { AddLeaveModal } from "@/components/admin/leave/add-leave-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Download, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDisplayDate } from "@/lib/dates";

type LeaveType = { id: string; name: string };
type Department = { id: string; name: string };

const STATUS_TABS = [
  { value: "ALL", label: "All Requests" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const PERIOD_OPTIONS = [
  { value: "", label: "All time" },
  { value: "this_month", label: "This month" },
  { value: "last_30", label: "Last 30 days" },
  { value: "this_year", label: "This year" },
];

/** Admin leave management page — view, approve, and reject employee leave requests */
export default function AdminLeavePage() {
  const queryClient = useQueryClient();
  const [statusTab, setStatusTab] = useState("ALL");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [period, setPeriod] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const { data: leaveTypesData } = useQuery<LeaveType[]>({
    queryKey: ["leave-types-active"],
    queryFn: async () => {
      const res = await fetch("/api/settings/leave-types");
      const json = await res.json();
      return (json.data ?? []) as LeaveType[];
    },
    staleTime: 60_000,
  });

  const { data: departmentsData } = useQuery<Department[]>({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await fetch("/api/departments");
      const json = await res.json();
      return (json.data ?? []) as Department[];
    },
    staleTime: 60_000,
  });

  const { data: statsData } = useQuery({
    queryKey: ["leave-stats", statsRefreshKey],
    queryFn: async () => {
      const res = await fetch("/api/leave/stats");
      const json = await res.json();
      return json.data as { pendingCount: number };
    },
    staleTime: 30_000,
  });

  const handleStatsRefresh = useCallback(() => {
    setStatsRefreshKey((k) => k + 1);
    queryClient.invalidateQueries({ queryKey: ["leave-stats-badge"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }, [queryClient]);

  function handleTabChange(value: string) {
    setStatusTab(value);
    setPage(1);
  }

  function handleFilterChange() {
    setPage(1);
  }

  async function handleExportCSV() {
    const params = new URLSearchParams({
      ...(statusTab !== "ALL" ? { status: statusTab } : {}),
      ...(leaveTypeId ? { leaveTypeId } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(period ? { period } : {}),
      ...(search ? { search } : {}),
      limit: "1000",
    });
    const res = await fetch(`/api/leave/requests?${params}`);
    const json = await res.json();
    const requests = json.data?.requests ?? [];

    const headers = ["Employee", "Department", "Leave Type", "Start Date", "End Date", "Working Days", "Status", "Note", "Submitted"];
    const rows = requests.map((r: {
      employee: { firstName: string; lastName: string; department?: { name: string } | null };
      policy: { name: string };
      startDate: string;
      endDate: string;
      workingDays: number;
      status: string;
      note?: string | null;
      createdAt: string;
    }) => [
      `${r.employee.firstName} ${r.employee.lastName}`,
      r.employee.department?.name ?? "",
      r.policy.name,
      r.startDate,
      r.endDate,
      r.workingDays,
      r.status,
      r.note ?? "",
      formatDisplayDate(r.createdAt),
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell: string | number) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leave-requests-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Management"
        description="Review and approve employee leave requests"
        actions={
          <Button onClick={() => setAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Leave
          </Button>
        }
      />

      {(statsData?.pendingCount ?? 0) > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium">
              {statsData!.pendingCount} leave request{statsData!.pendingCount !== 1 ? "s" : ""} awaiting your approval
            </p>
            <p className="text-amber-800/80 mt-0.5">
              Review pending requests below or switch to the Pending tab to approve or reject.
            </p>
          </div>
          {statusTab !== "PENDING" && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto shrink-0 border-amber-300 bg-white hover:bg-amber-100"
              onClick={() => handleTabChange("PENDING")}
            >
              View pending
            </Button>
          )}
        </div>
      )}

      {/* Stats row */}
      <LeaveStatsCards refreshKey={statsRefreshKey} />

      {/* Status tabs */}
      <Tabs value={statusTab} onValueChange={handleTabChange}>
        <TabsList className="w-full sm:w-auto">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="relative">
              {tab.label}
              {tab.value === "PENDING" && (statsData?.pendingCount ?? 0) > 0 && (
                <span className={cn(
                  "ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                  statusTab === "PENDING" ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-700"
                )}>
                  {statsData!.pendingCount}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={leaveTypeId}
          onValueChange={(v) => { setLeaveTypeId(v === "all" ? "" : v); handleFilterChange(); }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Leave Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {(leaveTypesData ?? []).map((lt) => (
              <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={departmentId}
          onValueChange={(v) => { setDepartmentId(v === "all" ? "" : v); handleFilterChange(); }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {(departmentsData ?? []).map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={period}
          onValueChange={(v) => { setPeriod(v === "all" ? "" : v); handleFilterChange(); }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Date Range" />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.value || "all"} value={o.value || "all"}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); handleFilterChange(); }}
          className="w-48"
        />

        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <LeaveRequestsTable
        statusFilter={statusTab}
        leaveTypeId={leaveTypeId || undefined}
        departmentId={departmentId || undefined}
        period={period || undefined}
        search={search || undefined}
        page={page}
        onPageChange={setPage}
        onStatsRefresh={handleStatsRefresh}
      />

      {/* Add leave modal */}
      <AddLeaveModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSuccess={handleStatsRefresh}
      />
    </div>
  );
}
