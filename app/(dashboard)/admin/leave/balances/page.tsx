"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { EditBalanceDrawer } from "@/components/admin/leave/edit-balance-drawer";
import { AccrualDetailDrawer } from "@/components/admin/leave/accrual-detail-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatLeaveBalanceValue } from "@/lib/utils";
import { useCurrentUser } from "@/lib/hooks/use-current-user";

type LeaveType = { id: string; name: string; defaultDays: number };

type BalanceEntry = {
  balanceId: string | null;
  allowance: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
};

type EmployeeBalance = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  department: { name: string } | null;
  avatarInitials: string;
  balances: Record<string, BalanceEntry>;
};

const AVATAR_COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-orange-500",
  "bg-rose-500", "bg-teal-500", "bg-amber-500", "bg-cyan-500",
];

function getAvatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function BalanceMiniBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? (used / total) * 100 : 0;
  const color = pct < 50 ? "bg-green-500" : pct < 80 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="font-medium">{formatLeaveBalanceValue(used)}</span>
        <span className="text-muted-foreground">/ {formatLeaveBalanceValue(total)}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

/** Leave balances overview — all employees × all active leave types */
export default function LeaveBalancesPage() {
  const { role } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [editEmployee, setEditEmployee] = useState<EmployeeBalance | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accrualEmployee, setAccrualEmployee] = useState<EmployeeBalance | null>(null);
  const [accrualOpen, setAccrualOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery<{
    employees: EmployeeBalance[];
    leaveTypes: LeaveType[];
  }>({
    queryKey: ["leave-balances"],
    queryFn: async () => {
      const res = await fetch("/api/leave/balances");
      const json = await res.json();
      return json.data;
    },
    staleTime: 30_000,
  });

  const employees = (data?.employees ?? []).filter((emp) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      emp.firstName.toLowerCase().includes(q) ||
      emp.lastName.toLowerCase().includes(q) ||
      (emp.department?.name ?? "").toLowerCase().includes(q)
    );
  });

  const leaveTypes = data?.leaveTypes ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Balances"
        description="Current year leave balances for all active employees"
      />

      <div className="flex items-center gap-3">
        <Input
          placeholder="Search employees…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase">Employee</th>
              {leaveTypes.map((lt) => (
                <th key={lt.id} className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase whitespace-nowrap">
                  {lt.name}
                </th>
              ))}
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b">
                  <td className="px-4 py-3"><Skeleton className="h-8 w-40" /></td>
                  {Array.from({ length: 3 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-6 w-24" /></td>
                  ))}
                  <td className="px-4 py-3"><Skeleton className="h-7 w-20" /></td>
                </tr>
              ))}

            {!isLoading && employees.length === 0 && (
              <tr>
                <td colSpan={leaveTypes.length + 2} className="px-4 py-12 text-center text-muted-foreground">
                  No employees found.
                </td>
              </tr>
            )}

            {!isLoading &&
              employees.map((emp) => (
                <tr key={emp.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0", getAvatarColor(emp.id))}>
                        {emp.avatarInitials}
                      </div>
                      <div>
                        <p className="font-medium">{emp.firstName} {emp.lastName}</p>
                        {emp.department && <p className="text-xs text-muted-foreground">{emp.department.name}</p>}
                      </div>
                    </div>
                  </td>
                  {leaveTypes.map((lt) => {
                    const b = emp.balances[lt.id];
                    return (
                      <td key={lt.id} className="px-4 py-3 min-w-[100px]">
                        {b ? (
                          <BalanceMiniBar used={b.usedDays} total={b.allowance} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          setAccrualEmployee(emp);
                          setAccrualOpen(true);
                        }}
                      >
                        Accrual
                      </Button>
                      {role === "SUPER_ADMIN" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => { setEditEmployee(emp); setDrawerOpen(true); }}
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <AccrualDetailDrawer
        employeeId={accrualEmployee?.id ?? null}
        employeeName={
          accrualEmployee
            ? `${accrualEmployee.firstName} ${accrualEmployee.lastName}`
            : ""
        }
        open={accrualOpen}
        onOpenChange={(open) => {
          setAccrualOpen(open);
          if (!open) setAccrualEmployee(null);
        }}
        onRefresh={() => refetch()}
      />

      <EditBalanceDrawer
        employee={editEmployee}
        leaveTypes={leaveTypes}
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) refetch();
        }}
      />
    </div>
  );
}
