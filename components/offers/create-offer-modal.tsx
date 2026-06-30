"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, Send, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { generateOfferLetterPdfFromData } from "@/lib/offers/offer-letter-pdf";

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

type Props = {
  open: boolean;
  onClose: () => void;
};

const PAY_FREQ_LABELS: Record<string, string> = {
  WEEKLY: "weekly",
  BIWEEKLY: "bi-weekly",
  SEMI_MONTHLY: "twice monthly",
  MONTHLY: "monthly",
};

function formatPreviewCompensation(values: FormValues): string {
  const rate = values.payRate ? parseFloat(values.payRate) : null;
  if (!rate) return values.payType === "HOURLY" ? "Hourly rate TBD" : "Salary TBD";
  if (values.payType === "HOURLY") return `$${rate.toFixed(2)} per hour`;
  const freq = values.payFrequency ? (PAY_FREQ_LABELS[values.payFrequency] ?? "") : "";
  return `$${Math.round(rate).toLocaleString("en-US")} per year${freq ? ` (${freq})` : ""}`;
}

function formatPreviewStartDate(dateStr: string): string {
  if (!dateStr) return "TBD";
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    return format(new Date(year, month - 1, day), "MMMM d, yyyy");
  } catch {
    return dateStr;
  }
}

function OfferLetterPreview({ values }: { values: FormValues }) {
  const fullName =
    values.candidateFirst || values.candidateLast
      ? `${values.candidateFirst} ${values.candidateLast}`.trim()
      : "Employee Name";
  const position = values.jobTitle || "POSITION";
  const startDate = formatPreviewStartDate(values.startDate);
  const compensation = formatPreviewCompensation(values);
  const today = format(new Date(), "MMMM d, yyyy");

  return (
    <div className="font-serif text-[13px] leading-relaxed text-slate-800 space-y-3 p-1">
      <p className="text-slate-500 text-xs">{today}</p>
      <p>{fullName}</p>
      <p>
        We are pleased to extend an offer of employment for the position of{" "}
        <strong>{position}</strong>. We were impressed with your skills and experience and are
        excited about the potential you bring to our team.
      </p>
      <p>
        <strong>Start Date:</strong> {startDate}
      </p>
      <p>
        <strong>Compensation:</strong> {compensation}
      </p>
      <p className="font-semibold mt-2">Contingencies:</p>
      <p>
        This offer may be contingent upon the successful completion of a background screening and
        drug test.
      </p>
      <p>
        Additionally, employment is contingent upon your ability to provide valid documentation for
        I-9 verification, which must be completed within 72 hours of your hire date.
      </p>
      <p className="font-semibold mt-2">Introductory Period</p>
      <p>
        Your employment will begin with a 30-day introductory period. This period allows both you
        and the Company to assess mutual fit and performance, and provides time to evaluate your
        progress, attendance, and overall suitability for the role.
      </p>
      <p className="font-semibold mt-2">Company Policies</p>
      <p>
        As an employee, you are expected to comply with all Company policies, procedures, and
        standards of conduct at all times. These policies are designed to support a safe,
        professional, and productive work environment.
      </p>
      <p className="font-semibold mt-2">At-Will Employment:</p>
      <p>
        Please note that your employment with the company is at-will. This means that either you or
        the company can terminate the employment relationship at any time, with or without cause or
        notice.
      </p>
      <p>
        We are excited about the possibility of you joining our team and contributing to our
        continued success. If you have any questions or need further clarification, please feel free
        to contact us.
      </p>
      <p>Sincerely,</p>
      <p className="font-semibold">Hayk Zohrabyan, CEO</p>
      <div className="border-t pt-3 mt-2 space-y-2">
        <p className="font-semibold">Acceptance of Offer</p>
        <p>
          I, <strong>{fullName}</strong>, accept the offer of employment for the position of{" "}
          <strong>{position}</strong>. I understand and agree to the terms and conditions outlined
          in this offer letter.
        </p>
        <p className="text-slate-500 text-xs mt-3">
          Signature: ___________________________ &nbsp;&nbsp; Date: ___________________________
        </p>
        <p className="text-slate-500 text-xs">Name: ___________________________</p>
      </div>
    </div>
  );
}

export function CreateOfferModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);
  const sendNowRef = useRef(true);

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

  const values = watch();
  const payType = values.payType;

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          payRate: values.payRate ? parseFloat(values.payRate) : undefined,
          sendNow: sendNowRef.current,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "Failed to create offer");
        return;
      }
      toast.success(sendNowRef.current ? "Offer sent to candidate" : "Offer saved as draft");
      qc.invalidateQueries({ queryKey: ["job-offers"] });
      reset();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      const bytes = await generateOfferLetterPdfFromData({
        candidateFirst: values.candidateFirst || "Employee",
        candidateLast: values.candidateLast || "",
        jobTitle: values.jobTitle || "Position",
        startDate: values.startDate || new Date().toISOString().slice(0, 10),
        payType: values.payType,
        payRate: values.payRate ? parseFloat(values.payRate) : undefined,
        payFrequency: values.payFrequency,
      });
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const lastName = values.candidateLast || "candidate";
      a.download = `offer-letter-${lastName.toLowerCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  }

  async function handleSendEmail() {
    if (!values.candidateEmail) {
      toast.error("Enter the candidate's email on the Details tab first");
      return;
    }
    if (!values.jobTitle || !values.startDate) {
      toast.error("Fill in Job Title and Start Date on the Details tab first");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/offers/send-preview-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateFirst: values.candidateFirst || "Candidate",
          candidateLast: values.candidateLast || "",
          candidateEmail: values.candidateEmail,
          jobTitle: values.jobTitle,
          startDate: values.startDate,
          payType: values.payType,
          payRate: values.payRate ? parseFloat(values.payRate) : undefined,
          payFrequency: values.payFrequency,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "Failed to send");
        return;
      }
      toast.success(`Offer letter sent to ${values.candidateEmail}`);
    } catch {
      toast.error("Failed to send offer letter");
    } finally {
      setSending(false);
    }
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="w-[min(96vw,980px)] max-w-[980px] max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Job Offer</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full">
            <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
            <TabsTrigger value="offer-letter" className="flex-1">Offer Letter</TabsTrigger>
          </TabsList>

          {/* ── Details Tab ── */}
          <TabsContent value="details" className="flex-1 overflow-y-auto mt-0 px-1 pr-2">
            <form id="offer-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-4">
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
                <div className="space-y-1 mt-3">
                  <Label>
                    Phone Number{" "}
                    <span className="text-muted-foreground font-normal">(for SMS notification)</span>
                  </Label>
                  <Input {...register("candidatePhone")} type="tel" placeholder="+1 555 000 0000" />
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
                        onValueChange={(v) =>
                          setValue("payFrequency", v as FormValues["payFrequency"])
                        }
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
                <Label>
                  Notes <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  {...register("notes")}
                  placeholder="Any additional information for the candidate…"
                  rows={3}
                />
              </div>
            </form>
          </TabsContent>

          {/* ── Offer Letter Tab ── */}
          <TabsContent value="offer-letter" className="flex-1 flex flex-col min-h-0 mt-0">
            <div className="flex items-center gap-2 py-3 border-b">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadPdf}
                disabled={downloading}
              >
                {downloading ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                )}
                Download PDF
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSendEmail}
                disabled={sending}
              >
                {sending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                )}
                Send to Email
              </Button>
              {values.candidateEmail && (
                <span className="text-xs text-muted-foreground truncate">
                  → {values.candidateEmail}
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto py-4 pr-1">
              <div className="bg-white border rounded-lg shadow-sm p-8 max-w-[520px] mx-auto">
                <div className="text-center mb-5 pb-4 border-b">
                  <p className="font-bold text-sm tracking-wide">Bazaar Printing</p>
                  <p className="text-xs text-muted-foreground">HR Department</p>
                  <p className="font-semibold text-sm mt-1 tracking-widest uppercase text-slate-700">
                    Offer Letter
                  </p>
                </div>
                <OfferLetterPreview values={values} />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-3 border-t">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={submitting}
            className="sm:mr-auto"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="offer-form"
            variant="outline"
            disabled={submitting}
            onClick={() => { sendNowRef.current = false; }}
          >
            Save as Draft
          </Button>
          <Button
            type="submit"
            form="offer-form"
            disabled={submitting}
            onClick={() => { sendNowRef.current = true; }}
          >
            {submitting ? "Saving…" : "Send Offer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
