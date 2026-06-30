"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Plus,
  Send,
  Trash2,
  UserPlus,
  ExternalLink,
  RefreshCw,
  Pencil,
  ClipboardList,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateOfferModal } from "@/components/offers/create-offer-modal";
import { ConvertOfferModal } from "@/components/offers/convert-offer-modal";
import { EditOfferModal } from "@/components/offers/edit-offer-modal";
import { ViewIntakeModal } from "@/components/offers/view-intake-modal";
import { generateOfferLetterPdfFromData } from "@/lib/offers/offer-letter-pdf";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type JobOffer = {
  id: string;
  candidateFirst: string;
  candidateLast: string;
  candidateEmail: string;
  candidatePhone: string | null;
  jobTitle: string;
  payType: "HOURLY" | "SALARY";
  payRate: number | null;
  payFrequency: "WEEKLY" | "BIWEEKLY" | "SEMI_MONTHLY" | "MONTHLY" | null;
  startDate: string;
  workType: "REMOTE" | "ONSITE" | "HYBRID";
  notes: string | null;
  status: string;
  token: string;
  sentAt: string | null;
  viewedAt: string | null;
  approvedAt: string | null;
  declinedAt: string | null;
  convertedAt: string | null;
  employeeId: string | null;
  createdAt: string;
  intake: { id: string; submittedAt: string } | null;
};

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  DRAFT:           { label: "Draft",           class: "bg-slate-100 text-slate-600" },
  SENT:            { label: "Sent",            class: "bg-blue-100 text-blue-700" },
  VIEWED:          { label: "Viewed",          class: "bg-indigo-100 text-indigo-700" },
  APPROVED:        { label: "Accepted",        class: "bg-amber-100 text-amber-700" },
  DECLINED:        { label: "Declined",        class: "bg-red-100 text-red-700" },
  INTAKE_COMPLETE: { label: "Ready to Convert", class: "bg-green-100 text-green-700" },
  CONVERTED:       { label: "Converted",       class: "bg-purple-100 text-purple-700" },
};

const WORK_TYPE_LABELS: Record<string, string> = {
  REMOTE: "Remote",
  ONSITE: "On-site",
  HYBRID: "Hybrid",
};

function formatPay(payType: string, payRate: number | null, payFrequency: string | null): string {
  if (!payRate) return payType === "HOURLY" ? "Hourly (TBD)" : "Salary (TBD)";
  if (payType === "HOURLY") return `$${payRate.toLocaleString()}/hr`;
  const freqs: Record<string, string> = { WEEKLY: "wk", BIWEEKLY: "biweek", SEMI_MONTHLY: "semi-mo", MONTHLY: "mo" };
  return `$${payRate.toLocaleString()}/${payFrequency ? (freqs[payFrequency] ?? "") : "yr"}`;
}

export default function AdminOffersPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [convertOffer, setConvertOffer] = useState<JobOffer | null>(null);
  const [editOffer, setEditOffer] = useState<JobOffer | null>(null);
  const [deleteOffer, setDeleteOffer] = useState<JobOffer | null>(null);
  const [viewIntakeId, setViewIntakeId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: offers, isLoading } = useQuery<JobOffer[]>({
    queryKey: ["job-offers"],
    queryFn: async () => {
      const res = await fetch("/api/offers");
      const json = await res.json();
      return json.data ?? [];
    },
  });

  async function handleResend(offer: JobOffer) {
    setResending(offer.id);
    try {
      const res = await fetch(`/api/offers/${offer.id}/resend`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "Failed to send");
        return;
      }
      toast.success("Offer resent");
      qc.invalidateQueries({ queryKey: ["job-offers"] });
    } finally {
      setResending(null);
    }
  }

  async function handleDelete() {
    if (!deleteOffer) return;
    setDeletingId(deleteOffer.id);
    try {
      const res = await fetch(`/api/offers/${deleteOffer.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "Failed to delete");
      } else {
        toast.success("Offer deleted");
        qc.invalidateQueries({ queryKey: ["job-offers"] });
      }
    } finally {
      setDeletingId(null);
      setDeleteOffer(null);
    }
  }

  async function handleDownloadOfferLetter(offer: JobOffer) {
    setDownloadingId(offer.id);
    try {
      const dateOnly = offer.startDate?.split("T")[0] ?? offer.startDate;
      const bytes = await generateOfferLetterPdfFromData({
        candidateFirst: offer.candidateFirst,
        candidateLast: offer.candidateLast,
        jobTitle: offer.jobTitle,
        startDate: dateOnly,
        payType: offer.payType,
        payRate: offer.payRate ?? undefined,
        payFrequency: offer.payFrequency ?? undefined,
      });

      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `offer-letter-${offer.candidateLast.toLowerCase() || "candidate"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download offer letter");
    } finally {
      setDownloadingId(null);
    }
  }

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job Offers"
        description="Create and track offers sent to candidates"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Offer
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : !offers?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">No job offers yet.</p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create your first offer
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {offers.map((offer) => {
            const statusCfg = STATUS_CONFIG[offer.status] ?? STATUS_CONFIG["DRAFT"];
            const canResend = offer.status !== "CONVERTED";
            const canConvert = offer.status === "INTAKE_COMPLETE";
            const canDelete = true;
            const canEdit = offer.status !== "CONVERTED";

            return (
              <Card key={offer.id} className={cn("transition-colors", offer.status === "INTAKE_COMPLETE" && "border-green-300 bg-green-50/30")}>
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">
                          {offer.candidateFirst} {offer.candidateLast}
                        </p>
                        <Badge variant="outline" className={cn("text-xs", statusCfg.class)}>
                          {statusCfg.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{offer.jobTitle}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                        <span>{formatPay(offer.payType, offer.payRate, offer.payFrequency)}</span>
                        <span>·</span>
                        <span>{WORK_TYPE_LABELS[offer.workType] ?? offer.workType}</span>
                        <span>·</span>
                        <span>Start {format(new Date(offer.startDate), "MMM d, yyyy")}</span>
                        <span>·</span>
                        <span className="text-slate-400">{offer.candidateEmail}</span>
                      </div>
                      {offer.intake && (
                        <p className="text-xs text-green-700 font-medium mt-1">
                          Intake submitted {format(new Date(offer.intake.submittedAt), "MMM d, yyyy")}
                        </p>
                      )}
                      {offer.sentAt && !offer.intake && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Sent {format(new Date(offer.sentAt), "MMM d, yyyy")}
                          {offer.viewedAt && ` · Viewed ${format(new Date(offer.viewedAt), "MMM d, yyyy")}`}
                        </p>
                      )}
                      {offer.convertedAt && (
                        <p className="text-xs text-purple-700 mt-1">
                          Converted to employee {format(new Date(offer.convertedAt), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {offer.intake && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-green-300 text-green-700 hover:bg-green-50"
                          onClick={() => setViewIntakeId(offer.id)}
                        >
                          <ClipboardList className="h-3.5 w-3.5 mr-1" />
                          View Intake
                        </Button>
                      )}
                      {canResend && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResend(offer)}
                          disabled={resending === offer.id}
                        >
                          {offer.status === "DRAFT" ? (
                            <><Send className="h-3.5 w-3.5 mr-1" />Send</>
                          ) : (
                            <><RefreshCw className="h-3.5 w-3.5 mr-1" />Resend</>
                          )}
                        </Button>
                      )}
                      {canConvert && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => setConvertOffer(offer)}
                        >
                          <UserPlus className="h-3.5 w-3.5 mr-1" />
                          Convert to Employee
                        </Button>
                      )}
                      {canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditOffer(offer)}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadOfferLetter(offer)}
                        disabled={downloadingId === offer.id}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        {downloadingId === offer.id ? "Downloading..." : "Download Letter"}
                      </Button>
                      {offer.employeeId && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={`/admin/employees/${offer.employeeId}`}>
                            <ExternalLink className="h-3.5 w-3.5 mr-1" />
                            View Employee
                          </a>
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteOffer(offer)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canResend && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground"
                          onClick={() => {
                            const link = `${appUrl}/candidate/${offer.token}`;
                            navigator.clipboard.writeText(link);
                            toast.success("Link copied");
                          }}
                        >
                          Copy Link
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreateOfferModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <ViewIntakeModal
        offerId={viewIntakeId}
        open={!!viewIntakeId}
        onClose={() => setViewIntakeId(null)}
      />

      <EditOfferModal
        offer={editOffer}
        open={!!editOffer}
        onClose={() => setEditOffer(null)}
      />

      <ConvertOfferModal
        offer={convertOffer}
        open={!!convertOffer}
        onClose={() => setConvertOffer(null)}
      />

      <Dialog open={!!deleteOffer} onOpenChange={(v) => !v && setDeleteOffer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Offer?</DialogTitle>
            <DialogDescription>
              This will permanently delete the offer for{" "}
              {deleteOffer ? `${deleteOffer.candidateFirst} ${deleteOffer.candidateLast}` : "this candidate"}.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOffer(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deletingId === deleteOffer?.id}
            >
              {deletingId === deleteOffer?.id ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
