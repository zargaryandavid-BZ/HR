"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { PageHeader, DataTable, EmptyState } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TableRowSkeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { formatDisplayDate } from "@/lib/dates";
import { formatEmployeeName } from "@/lib/utils";
import { EmployeeClassificationBadge } from "@/components/shared/employee-classification-badge";

type Employee = {
  id: string;
  employeeNumber: string | null;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  workEmail: string | null;
  jobTitle: string | null;
  scheduleType: string;
  status: string;
  isNonExempt: boolean;
  missingSignedDocuments: number;
  identityDocumentExpiring: boolean;
  department: { id: string; name: string } | null;
  startDate: string | null;
};

function formatStartDate(startDate: string | null): string {
  if (!startDate) return "—";
  try {
    return formatDisplayDate(startDate);
  } catch {
    return "—";
  }
}

/** HR Admin employee list with search, filters, and pagination */
export default function EmployeesPage() {
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await fetch("/api/departments");
      const json = await res.json();
      return json.data as { id: string; name: string }[];
    },
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["employees", search, departmentId, status, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (departmentId) params.set("departmentId", departmentId);
      if (status) params.set("status", status);

      const res = await fetch(`/api/employees?${params}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? "Failed to load employees");
      }
      if (!json.data) {
        throw new Error("Invalid response from server");
      }
      return json.data as {
        employees: Employee[];
        summary: {
          totalMissingSignedDocuments: number;
          employeesWithMissingSignedDocuments: number;
        };
        pagination: { page: number; totalPages: number; total: number };
      };
    },
  });

  const employees = data?.employees ?? [];
  const pagination = data?.pagination;
  const summary = data?.summary;
  const hasActiveFilters = Boolean(search || departmentId || status);

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Manage employee profiles and schedules"
        actions={
          <Button asChild>
            <Link href="/admin/employees/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </Link>
          </Button>
        }
      />

      {summary && summary.totalMissingSignedDocuments > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-medium">{summary.totalMissingSignedDocuments}</span> signed document
          {summary.totalMissingSignedDocuments === 1 ? "" : "s"} missing across{" "}
          <span className="font-medium">{summary.employeesWithMissingSignedDocuments}</span>{" "}
          employee{summary.employeesWithMissingSignedDocuments === 1 ? "" : "s"}.
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={departmentId || "all"}
          onValueChange={(v) => {
            setDepartmentId(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments?.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status || "all"}
          onValueChange={(v) => {
            setStatus(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <DataTable>
          <thead>
            <tr className="border-b bg-muted/50">
              {["ID", "Name", "Department", "Job Title", "Job starting date", "Schedule", "Missing Signed", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRowSkeleton key={i} columns={8} />
            ))}
          </tbody>
        </DataTable>
      ) : isError ? (
        <EmptyState
          title="Could not load employees"
          description={error instanceof Error ? error.message : "Something went wrong. Try again."}
          action={
            <Button onClick={() => refetch()}>Retry</Button>
          }
        />
      ) : employees.length === 0 ? (
        <EmptyState
          title="No employees found"
          description={
            hasActiveFilters
              ? "No employees match your current search or filters."
              : "Add your first employee to get started."
          }
          action={
            hasActiveFilters ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setDepartmentId("");
                  setStatus("");
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button asChild>
                <Link href="/admin/employees/new">Add Employee</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <DataTable>
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">ID</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Department</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Job Title</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">
                  Job starting date
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Schedule</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Missing Signed</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-medium text-muted-foreground">
                      {emp.employeeNumber ? String(emp.employeeNumber).padStart(6, "0") : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <div className="flex flex-col gap-1">
                      <span>
                        {formatEmployeeName(emp.firstName, emp.lastName, emp.preferredName)}
                      </span>
                      {emp.identityDocumentExpiring && (
                        <span className="inline-flex w-fit items-center rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 text-[10px] font-medium">
                          ⚠ Document expiring
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {emp.department?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{emp.jobTitle ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatStartDate(emp.startDate)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{emp.scheduleType.replace("_", " ")}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {emp.missingSignedDocuments > 0 ? (
                      <Badge variant="destructive">{emp.missingSignedDocuments} pending</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <EmployeeClassificationBadge isNonExempt={emp.isNonExempt ?? true} />
                      <Badge variant={emp.status === "ACTIVE" ? "success" : "secondary"}>
                        {emp.status}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/admin/employees/${emp.id}`}>View</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
