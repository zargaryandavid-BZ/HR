"use client";

import { formatStoredDateRange } from "@/lib/dates";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorMessage } from "@/components/shared/page-header";

type LeaveRequestRow = {
  id: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  workingDays: number;
  status: string;
  notes: string | null;
  submittedAt: string;
};

type EmployeeLeaveHistoryProps = {
  employeeId: string;
};

/** Read-only list of confirmed (approved) leave for an employee */
export function EmployeeLeaveHistory({ employeeId }: EmployeeLeaveHistoryProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["employee-leave-history", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/leave`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load leave history");
      return json.data as { requests: LeaveRequestRow[] };
    },
  });

  const confirmed = (data?.requests ?? []).filter((r) => r.status === "APPROVED");

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (isError) {
    return <ErrorMessage message="Failed to load confirmed leave" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirmed Leave</CardTitle>
        <p className="text-sm text-muted-foreground">
          Approved leave requests for this employee.
        </p>
      </CardHeader>
      <CardContent>
        {confirmed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No confirmed leave on record.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">Dates</th>
                  <th className="pb-2 pr-4 font-medium">Days</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {confirmed.map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="py-3 pr-4 font-medium">{row.leaveTypeName}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {formatStoredDateRange(row.startDate.slice(0, 10), row.endDate.slice(0, 10))}
                    </td>
                    <td className="py-3 pr-4">{row.workingDays}</td>
                    <td className="py-3 pr-4">
                      <Badge variant="success">Approved</Badge>
                    </td>
                    <td className="py-3 text-muted-foreground">{row.notes?.trim() || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
