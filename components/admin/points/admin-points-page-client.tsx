"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Search, ShieldAlert, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DataTable, EmptyState, ErrorMessage, PageHeader } from "@/components/shared/page-header";
import { formatDisplayDate } from "@/lib/dates";
import type { PointTier } from "@/lib/points";

type PointsRow = {
  employeeId: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  department: string | null;
  position: string | null;
  totalPoints: number;
  tier: PointTier;
  activeViolationCount: number;
  nextExpiry: string | null;
};

const tierLabels: Record<PointTier, string> = {
  CLEAR: "Clear",
  WATCH: "Watch",
  WARNING: "Warning",
  CRITICAL: "Critical",
  TERMINATION: "Termination review",
};

function TierBadge({ tier }: { tier: PointTier }) {
  const variant =
    tier === "CLEAR" ? "success" : tier === "WATCH" ? "secondary" : tier === "WARNING" ? "warning" : "destructive";
  return <Badge variant={variant}>{tierLabels[tier]}</Badge>;
}

/** Admin overview of employee conduct-point balances. */
export function AdminPointsPageClient() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const query = useQuery<PointsRow[]>({
    queryKey: ["admin-points"],
    queryFn: async () => {
      const response = await fetch("/api/admin/points");
      const json = await response.json();
      if (!response.ok) throw new Error(json.message ?? "Failed to load points");
      return json.data ?? [];
    },
  });
  const expire = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/points/expire", { method: "POST" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message ?? "Failed to expire points");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-points"] }),
  });

  const rows = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return query.data ?? [];
    return (query.data ?? []).filter((row) =>
      [row.firstName, row.lastName, row.preferredName, row.department, row.position]
        .some((field) => field?.toLowerCase().includes(value))
    );
  }, [query.data, search]);
  const total = query.data?.length ?? 0;
  const withPoints = query.data?.filter((row) => row.totalPoints > 0).length ?? 0;
  const critical = query.data?.filter(
    (row) => row.tier === "CRITICAL" || row.tier === "TERMINATION"
  ).length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Points"
        description="Review employee conduct-point balances and violations."
        actions={
          <Button variant="outline" disabled={expire.isPending} onClick={() => expire.mutate()}>
            Expire due points
          </Button>
        }
      />
      {(query.isError || expire.isError) && (
        <ErrorMessage message={(query.error ?? expire.error)?.message ?? "Unable to load employee points"} />
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric icon={<Users className="h-5 w-5" />} value={total} label="Active employees" />
        <Metric icon={<ShieldAlert className="h-5 w-5 text-amber-600" />} value={withPoints} label="With active points" />
        <Metric icon={<AlertTriangle className="h-5 w-5 text-destructive" />} value={critical} label="Critical standing" />
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employees" />
      </div>
      {query.isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading employee points…</p>
      ) : rows.length === 0 ? (
        <EmptyState title={search ? "No employees found" : "No employees to display"} />
      ) : (
        <DataTable>
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Employee</th>
              <th className="px-4 py-3 font-medium">Department / position</th>
              <th className="px-4 py-3 font-medium">Points</th>
              <th className="px-4 py-3 font-medium">Standing</th>
              <th className="px-4 py-3 font-medium">Next expiry</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.employeeId} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <p className="font-medium">{row.preferredName ?? row.firstName} {row.lastName}</p>
                  <p className="text-xs text-muted-foreground">{row.activeViolationCount} active violation{row.activeViolationCount === 1 ? "" : "s"}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <p>{row.department ?? "No department"}</p><p className="text-xs">{row.position ?? "No position"}</p>
                </td>
                <td className="px-4 py-3 font-semibold">{row.totalPoints}</td>
                <td className="px-4 py-3"><TierBadge tier={row.tier} /></td>
                <td className="px-4 py-3 text-muted-foreground">{row.nextExpiry ? formatDisplayDate(row.nextExpiry) : "—"}</td>
                <td className="px-4 py-3 text-right"><Button asChild size="sm" variant="outline"><Link href={`/admin/points/${row.employeeId}`}>Manage</Link></Button></td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return <Card><CardContent className="flex items-center gap-3 p-5">{icon}<div><p className="text-2xl font-semibold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div></CardContent></Card>;
}
