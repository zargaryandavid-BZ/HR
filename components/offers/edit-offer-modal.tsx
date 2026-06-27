"use client";

import { useEffect, useState } from "react";
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
  candidatePhone: z.string().optional(),
  jobTitle: z.string().min(1, "Required"),
  payType: z.enum(["HOURLY", "SALARY"]),
  payRate: z.string().optional(),
  payFrequency: z.enum(["WEEKLY", "BIWEEKLY", "SEMI_MONTHLY", "MONTHLY"]).optional(),
  startDate: z.string().min(1, "Required"),
  workType: z.enum(["REMOTE", "ONSITE", "HYBRID"]),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export type EditableOffer = {
  id: string;
  candidateFirst: string;
  candidateLast: string;
  candidateEmail: string;
  candidatePhone?: string | null;
  jobTitle: string;
  payType: "HOURLY" | "SALARY";
  payRate: number | null;
  payFrequency?: "WEEKLY" | "BIWEEKLY" | "SEMI_MONTHLY" | "MONTHLY" | null;
  startDate: string;
  workType: "REMOTE" | "ONSITE" | "HYBRID";
  notes: string | null;
};

type Props = {
  offer: EditableOffer | null;
  open: boolean;
  onClose: () => void;
};

function toDateInputValue(value: string): string {
  return value.slice(0, 10);
}

export function EditOfferModal({ offer, open, onClose }: Props) {
  const qc = useQueryClient();
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
      payType: "HOURLY",
      workType: "ONSITE",
    },
  });

  useEffect(() => {
    if (!offer || !open) return;
    reset({
      candidateFirst: offer.candidateFirst,
      candidateLast: offer.candidateLast,
      candidateEmail: offer.candidateEmail,
      candidatePhone: offer.candidatePhone ?? "",
      jobTitle: offer.jobTitle,
      payType: offer.payType,
      payRate: offer.payRate != null ? String(offer.payRate) : "",
      payFrequency: offer.payFrequency ?? undefined,
      startDate: toDateInputValue(offer.startDate),
      workType: offer.workType,
      notes: offer.notes ?? "",
    });
  }, [offer, open, reset]);

  const payType = watch("payType");

  async function onSubmit(values: FormValues) {
    if (!offer) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/offers/${offer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateFirst: values.candidateFirst,
          candidateLast: values.candidateLast,
          candidateEmail: values.candidateEmail,
          candidatePhone: values.candidatePhone?.trim() || null,
          jobTitle: values.jobTitle,
          payType: values.payType,
          payRate: values.payRate ? parseFloat(values.payRate) : null,
          payFrequency: values.payType === "SALARY" ? values.payFrequency ?? null : null,
          startDate: values.startDate,
          workType: values.workType,
          notes: values.notes?.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "Failed to update offer");
        return;
      }
      toast.success("Offer updated");
      qc.invalidateQueries({ queryKey: ["job-offers"] });
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
          <DialogTitle>Edit Offer</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Candidate
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>First Name</Label>
                <Input {...register("candidateFirst")} />
                {errors.candidateFirst && (
                  <p className="text-xs text-destructive">{errors.candidateFirst.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Last Name</Label>
                <Input {...register("candidateLast")} />
                {errors.candidateLast && (
                  <p className="text-xs text-destructive">{errors.candidateLast.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-1 mt-3">
              <Label>Email Address</Label>
              <Input {...register("candidateEmail")} type="email" />
              {errors.candidateEmail && (
                <p className="text-xs text-destructive">{errors.candidateEmail.message}</p>
              )}
            </div>
            <div className="space-y-1 mt-3">
              <Label>Phone Number</Label>
              <Input {...register("candidatePhone")} type="tel" />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Position
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>Job Title</Label>
                <Input {...register("jobTitle")} />
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
                <Input {...register("payRate")} type="number" step="0.01" min="0" />
              </div>
              {payType === "SALARY" && (
                <div className="space-y-1">
                  <Label>Pay Frequency</Label>
                  <Select
                    value={watch("payFrequency") ?? ""}
                    onValueChange={(v) => setValue("payFrequency", v as FormValues["payFrequency"])}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
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

          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea {...register("notes")} rows={3} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
