"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";

const schema = z.object({
  workEmail: z.string().email("Valid work email required"),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT"]),
  scheduleType: z.enum(["FIXED", "SHIFT_BASED", "HOURS_BASED", "FLEXIBLE"]),
});

type FormValues = z.infer<typeof schema>;

type Offer = {
  id: string;
  candidateFirst: string;
  candidateLast: string;
  jobTitle: string;
};

type Props = {
  offer: Offer | null;
  open: boolean;
  onClose: () => void;
};

export function ConvertOfferModal({ offer, open, onClose }: Props) {
  const qc = useQueryClient();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      employmentType: "FULL_TIME",
      scheduleType: "FIXED",
    },
  });

  const scheduleType = watch("scheduleType");

  function buildScheduleConfig(type: string): Record<string, unknown> {
    if (type === "FLEXIBLE") return { type: "FLEXIBLE" };
    if (type === "HOURS_BASED") return { type: "HOURS_BASED", period: "WEEKLY", requiredHours: 40 };
    if (type === "SHIFT_BASED") return { type: "SHIFT_BASED", shiftTemplateName: "Standard", workingDays: [1, 2, 3, 4, 5] };
    // FIXED / CUSTOM
    const days: Record<string, { start: string; end: string }[]> = {};
    for (const d of ["MON", "TUE", "WED", "THU", "FRI"]) {
      days[d] = [{ start: "09:00", end: "17:00" }];
    }
    for (const d of ["SAT", "SUN"]) days[d] = [];
    return { type: "CUSTOM", days };
  }

  async function onSubmit(values: FormValues) {
    if (!offer) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/offers/${offer.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workEmail: values.workEmail,
          employmentType: values.employmentType,
          scheduleType: values.scheduleType,
          scheduleConfig: buildScheduleConfig(values.scheduleType),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "Conversion failed");
        return;
      }
      toast.success("Employee account created");
      qc.invalidateQueries({ queryKey: ["job-offers"] });
      reset();
      onClose();
      if (json.data?.employeeId) {
        router.push(`/admin/employees/${json.data.employeeId}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Convert to Employee</DialogTitle>
          <DialogDescription>
            {offer ? `Create an employee account for ${offer.candidateFirst} ${offer.candidateLast} (${offer.jobTitle}).` : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>Work Email</Label>
            <Input {...register("workEmail")} type="email" placeholder="jane@bazaarprinting.com" />
            {errors.workEmail && (
              <p className="text-xs text-destructive">{errors.workEmail.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Employment Type</Label>
              <Select
                value={watch("employmentType")}
                onValueChange={(v) => setValue("employmentType", v as FormValues["employmentType"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL_TIME">Full Time</SelectItem>
                  <SelectItem value="PART_TIME">Part Time</SelectItem>
                  <SelectItem value="CONTRACT">Contract</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Schedule Type</Label>
              <Select
                value={scheduleType}
                onValueChange={(v) => setValue("scheduleType", v as FormValues["scheduleType"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXED">Fixed (9-5)</SelectItem>
                  <SelectItem value="SHIFT_BASED">Shift Based</SelectItem>
                  <SelectItem value="HOURS_BASED">Hours Based</SelectItem>
                  <SelectItem value="FLEXIBLE">Flexible</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                You can adjust the schedule in the employee profile after creation.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create Employee Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
