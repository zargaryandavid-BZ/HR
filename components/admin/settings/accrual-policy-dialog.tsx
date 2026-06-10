"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

type AccrualPolicy = {
  hoursWorkedPerAccrual: number;
  hoursEarnedPerAccrual: number;
  ptoAccrualCapHours: number;
  ptoRolloverCapHours: number;
  sickAccrualCapHours: number;
  usableAfterDays: number;
};

type Props = {
  positionId: string | null;
  positionName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DEFAULTS: AccrualPolicy = {
  hoursWorkedPerAccrual: 30,
  hoursEarnedPerAccrual: 1,
  ptoAccrualCapHours: 120,
  ptoRolloverCapHours: 40,
  sickAccrualCapHours: 80,
  usableAfterDays: 90,
};

/** Dialog to edit position-level PTO and sick leave accrual policy */
export function AccrualPolicyDialog({
  positionId,
  positionName,
  open,
  onOpenChange,
}: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AccrualPolicy>(DEFAULTS);

  const { data, isLoading } = useQuery<AccrualPolicy>({
    queryKey: ["accrual-policy", positionId],
    queryFn: async () => {
      const res = await fetch(`/api/settings/positions/${positionId}/accrual-policy`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load policy");
      return json.data;
    },
    enabled: open && !!positionId,
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/settings/positions/${positionId}/accrual-policy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to save");
    },
    onSuccess: () => {
      toast.success("Accrual policy saved");
      queryClient.invalidateQueries({ queryKey: ["accrual-policy", positionId] });
      onOpenChange(false);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function setField<K extends keyof AccrualPolicy>(key: K, value: number) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Accrual Policy — {positionName}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6">Loading…</p>
        ) : (
          <div className="space-y-5">
            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-medium">Accrual rate</p>
              <div className="flex items-center gap-2 text-sm">
                <span>1 hour per</span>
                <Input
                  type="number"
                  min={1}
                  className="w-20"
                  value={form.hoursWorkedPerAccrual}
                  onChange={(e) =>
                    setField("hoursWorkedPerAccrual", parseFloat(e.target.value) || 30)
                  }
                />
                <span>hours worked</span>
              </div>
              <p className="text-xs text-muted-foreground">
                California minimum: 1 hr per 30 hrs
              </p>
              <div className="flex items-center gap-2 text-sm">
                <Label className="shrink-0">Usage waiting period</Label>
                <Input
                  type="number"
                  min={1}
                  className="w-20"
                  value={form.usableAfterDays}
                  onChange={(e) =>
                    setField("usableAfterDays", parseInt(e.target.value, 10) || 90)
                  }
                />
                <span>days after hire date</span>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-medium">PTO</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Maximum balance (accrual cap)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.ptoAccrualCapHours}
                    onChange={(e) =>
                      setField("ptoAccrualCapHours", parseFloat(e.target.value) || 120)
                    }
                  />
                  <p className="text-xs text-muted-foreground">Accrual pauses here</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Year-end rollover cap</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.ptoRolloverCapHours}
                    onChange={(e) =>
                      setField("ptoRolloverCapHours", parseFloat(e.target.value) || 40)
                    }
                  />
                  <p className="text-xs text-muted-foreground">Excess forfeited Jan 1</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-medium">Sick Leave</p>
              <div className="space-y-1">
                <Label className="text-xs">Maximum balance (accrual cap)</Label>
                <Input
                  type="number"
                  min={80}
                  value={form.sickAccrualCapHours}
                  onChange={(e) =>
                    setField("sickAccrualCapHours", parseFloat(e.target.value) || 80)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  CA minimum: 80 hrs · Full rollover at year end
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || isLoading}
          >
            {saveMutation.isPending ? "Saving…" : "Save Accrual Policy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
