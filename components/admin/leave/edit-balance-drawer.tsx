"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatLeaveBalanceValue } from "@/lib/utils";

type LeaveType = { id: string; name: string; defaultDays: number };

type BalanceEntry = {
  balanceId: string | null;
  allowance: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
};

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  department: { name: string } | null;
  balances: Record<string, BalanceEntry>;
};

type Props = {
  employee: Employee | null;
  leaveTypes: LeaveType[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** SUPER_ADMIN-only drawer to manually adjust an employee's leave balances */
export function EditBalanceDrawer({ employee, leaveTypes, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();

  const [edits, setEdits] = useState<
    Record<string, { allowance: number; usedDays: number }>
  >({});

  useEffect(() => {
    if (!employee) return;
    const initial: Record<string, { allowance: number; usedDays: number }> = {};
    for (const lt of leaveTypes) {
      const b = employee.balances[lt.id];
      initial[lt.id] = {
        allowance: b?.allowance ?? lt.defaultDays,
        usedDays: b?.usedDays ?? 0,
      };
    }
    setEdits(initial);
  }, [employee, leaveTypes]);

  const mutation = useMutation({
    mutationFn: async ({ leaveTypeId, allowance, usedDays }: { leaveTypeId: string; allowance: number; usedDays: number }) => {
      const res = await fetch(`/api/leave/balances/${employee!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaveTypeId, allowance, usedDays }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.message ?? "Failed to update balance");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-balances"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  async function handleSave() {
    if (!employee) return;
    try {
      for (const lt of leaveTypes) {
        const edit = edits[lt.id];
        if (!edit) continue;
        await mutation.mutateAsync({ leaveTypeId: lt.id, allowance: edit.allowance, usedDays: edit.usedDays });
      }
      toast.success("Balances updated");
      onOpenChange(false);
    } catch {
      // Error already handled by mutation
    }
  }

  if (!employee) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader className="mb-4">
          <SheetTitle>Edit Balances — {employee.firstName} {employee.lastName}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5">
          {leaveTypes.map((lt) => {
            const edit = edits[lt.id] ?? { allowance: lt.defaultDays, usedDays: 0 };
            const remaining = edit.allowance - edit.usedDays;
            return (
              <div key={lt.id} className="rounded-md border p-3 space-y-3">
                <p className="font-medium text-sm">{lt.name}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Total Allowance</Label>
                    <Input
                      type="number"
                      min={0}
                      value={edit.allowance}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [lt.id]: { ...prev[lt.id], allowance: parseFloat(e.target.value) || 0 },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Used Days</Label>
                    <Input
                      type="number"
                      min={0}
                      value={edit.usedDays}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [lt.id]: { ...prev[lt.id], usedDays: parseFloat(e.target.value) || 0 },
                        }))
                      }
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Remaining after save:{" "}
                  <span className="font-medium">{formatLeaveBalanceValue(remaining)}</span> days
                </p>
              </div>
            );
          })}

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={mutation.isPending} className="flex-1">
              {mutation.isPending ? "Saving…" : "Save Balances"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
