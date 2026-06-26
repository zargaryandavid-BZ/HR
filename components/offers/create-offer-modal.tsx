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
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  candidateFirst: z.string().min(1, "Required"),
  candidateLast: z.string().min(1, "Required"),
  candidateEmail: z.string().email("Valid email required"),
  jobTitle: z.string().min(1, "Required"),
  payType: z.enum(["HOURLY", "SALARY"]),
  payRate: z.string().optional(),
  payFrequency: z.enum(["WEEKLY", "BIWEEKLY", "SEMI_MONTHLY", "MONTHLY"]).optional(),
  startDate: z.string().min(1, "Required"),
  workType: z.enum(["REMOTE", "ONSITE", "HYBRID"]),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CreateOfferModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [sendNow, setSendNow] = useState(true);

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
      payType: "HOURLY",
      workType: "ONSITE",
    },
  });

  const payType = watch("payType");

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          payRate: values.payRate ? parseFloat(values.payRate) : undefined,
          sendNow,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "Failed to create offer");
        return;
      }
      toast.success(sendNow ? "Offer sent to candidate" : "Offer saved as draft");
      qc.invalidateQueries({ queryKey: ["job-offers"] });
      reset();
      onClose();
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Job Offer</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Candidate */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Candidate
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>First Name</Label>
                <Input {...register("candidateFirst")} placeholder="Jane" />
                {errors.candidateFirst && (
                  <p className="text-xs text-destructive">{errors.candidateFirst.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Last Name</Label>
                <Input {...register("candidateLast")} placeholder="Smith" />
                {errors.candidateLast && (
                  <p className="text-xs text-destructive">{errors.candidateLast.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-1 mt-3">
              <Label>Email Address</Label>
              <Input {...register("candidateEmail")} type="email" placeholder="jane@example.com" />
              {errors.candidateEmail && (
                <p className="text-xs text-destructive">{errors.candidateEmail.message}</p>
              )}
            </div>
          </div>

          {/* Position */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Position
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>Job Title</Label>
                <Input {...register("jobTitle")} placeholder="Print Production Specialist" />
                {errors.jobTitle && (
                  <p className="text-xs text-destructive">{errors.jobTitle.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Start Date</Label>
                <Input {...register("startDate")} type="date" />
                {errors.startDate && (
                  <p className="text-xs text-destructive">{errors.startDate.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Work Type</Label>
                <Select
                  value={watch("workType")}
                  onValueChange={(v) => setValue("workType", v as FormValues["workType"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REMOTE">Remote</SelectItem>
                    <SelectItem value="ONSITE">On-site</SelectItem>
                    <SelectItem value="HYBRID">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Compensation */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Compensation
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Pay Type</Label>
                <Select
                  value={watch("payType")}
                  onValueChange={(v) => setValue("payType", v as FormValues["payType"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HOURLY">Hourly</SelectItem>
                    <SelectItem value="SALARY">Salary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{payType === "HOURLY" ? "Hourly Rate ($)" : "Salary ($)"}</Label>
                <Input {...register("payRate")} type="number" step="0.01" min="0" placeholder="0.00" />
              </div>
              {payType === "SALARY" && (
                <div className="space-y-1">
                  <Label>Pay Frequency</Label>
                  <Select
                    value={watch("payFrequency") ?? ""}
                    onValueChange={(v) => setValue("payFrequency", v as FormValues["payFrequency"])}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WEEKLY">Weekly</SelectItem>
                      <SelectItem value="BIWEEKLY">Bi-weekly</SelectItem>
                      <SelectItem value="SEMI_MONTHLY">Semi-monthly</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              {...register("notes")}
              placeholder="Any additional information for the candidate…"
              rows={3}
            />
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <div className="flex items-center gap-2 mr-auto">
              <Button
                type="button"
                variant={sendNow ? "default" : "outline"}
                size="sm"
                onClick={() => setSendNow(true)}
                className="text-xs"
              >
                Send Now
              </Button>
              <Button
                type="button"
                variant={!sendNow ? "default" : "outline"}
                size="sm"
                onClick={() => setSendNow(false)}
                className="text-xs"
              >
                Save as Draft
              </Button>
            </div>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : sendNow ? "Send Offer" : "Save Draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
