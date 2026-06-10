"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatLeaveBalanceHours } from "@/lib/utils";

type Props = {
  employeeId: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  currentBalanceHours: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

/** Modal for HR to manually add or deduct accrued leave hours */
export function ManualAdjustmentModal({
  employeeId,
  employeeName,
  leaveTypeId,
  leaveTypeName,
  currentBalanceHours,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const [adjustmentType, setAdjustmentType] = useState<"ADD" | "DEDUCT">("ADD");
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setAdjustmentType("ADD");
      setHours("");
      setNote("");
    }
  }, [open]);

  const parsedHours = parseFloat(hours) || 0;
  const projectedBalance =
    adjustmentType === "ADD"
      ? currentBalanceHours + parsedHours
      : Math.max(0, currentBalanceHours - parsedHours);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/leave-balances/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaveTypeId,
          hours: parsedHours,
          type: adjustmentType,
          note: note.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to adjust balance");
    },
    onSuccess: () => {
      toast.success("Balance adjusted");
      onOpenChange(false);
      onSuccess();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function handleSave() {
    if (parsedHours <= 0) {
      toast.error("Enter a valid number of hours");
      return;
    }
    if (!note.trim()) {
      toast.error("Reason is required");
      return;
    }
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Adjust {leaveTypeName} — {employeeName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Current balance: <span className="font-medium text-foreground">{formatLeaveBalanceHours(currentBalanceHours)} hrs</span>
          </p>

          <div className="space-y-2">
            <Label className="text-xs">Adjustment type</Label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={adjustmentType === "ADD"}
                  onChange={() => setAdjustmentType("ADD")}
                />
                Add hours
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={adjustmentType === "DEDUCT"}
                  onChange={() => setAdjustmentType("DEDUCT")}
                />
                Deduct hours
              </label>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Hours</Label>
            <Input
              type="number"
              min={0}
              step={0.25}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="8.0"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Reason (required)</Label>
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Correction, bonus grant, error fix"
            />
          </div>

          <p className="text-sm">
            New balance after adjustment:{" "}
            <span className={cn("font-semibold", projectedBalance === 0 && adjustmentType === "DEDUCT" && parsedHours > currentBalanceHours && "text-amber-600")}>
              {formatLeaveBalanceHours(projectedBalance)} hrs
            </span>
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save adjustment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
