"use client";

import { useState, use } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { CheckCircle, XCircle, Briefcase, Calendar, MapPin, DollarSign, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type Offer = {
  id: string;
  candidateFirst: string;
  candidateLast: string;
  jobTitle: string;
  payType: string;
  payRate: number | null;
  payFrequency: string | null;
  startDate: string;
  workType: "REMOTE" | "ONSITE" | "HYBRID";
  notes: string | null;
  status: string;
  intake: { id: string; submittedAt: string } | null;
};

const WORK_TYPE_LABELS: Record<string, string> = {
  REMOTE: "Remote",
  ONSITE: "On-site",
  HYBRID: "Hybrid",
};

function formatPay(payType: string, payRate: number | null, payFrequency: string | null): string {
  if (!payRate) return payType === "HOURLY" ? "Hourly (to be discussed)" : "Salary (to be discussed)";
  if (payType === "HOURLY") return `$${payRate.toLocaleString()} / hour`;
  const freqs: Record<string, string> = { WEEKLY: "/ week", BIWEEKLY: "/ bi-week", SEMI_MONTHLY: "/ semi-month", MONTHLY: "/ month" };
  return `$${payRate.toLocaleString()} ${payFrequency ? (freqs[payFrequency] ?? "") : "/ year"}`;
}

export default function CandidateOfferPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [acting, setActing] = useState(false);

  const { data: offer, isLoading, error } = useQuery<Offer>({
    queryKey: ["candidate-offer", token],
    queryFn: async () => {
      const res = await fetch(`/api/candidate/${token}`);
      if (!res.ok) throw new Error("Offer not found");
      const json = await res.json();
      return json.data;
    },
    retry: false,
  });

  async function handleAccept() {
    setActing(true);
    try {
      const res = await fetch(`/api/candidate/${token}/approve`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "Something went wrong");
        return;
      }
      toast.success("Offer accepted!");
      router.push(`/candidate/${token}/intake`);
    } finally {
      setActing(false);
    }
  }

  async function handleDecline() {
    setActing(true);
    try {
      const res = await fetch(`/api/candidate/${token}/decline`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "Something went wrong");
        return;
      }
      setDeclineOpen(false);
      toast.success("Offer declined");
      router.refresh();
    } finally {
      setActing(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="py-12">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-lg font-semibold mb-2">Offer Not Found</h1>
            <p className="text-sm text-muted-foreground">
              This link is invalid or the offer has expired. Please contact HR.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isDeclined = offer.status === "DECLINED";
  const isConverted = offer.status === "CONVERTED";
  const intakeDone = offer.status === "INTAKE_COMPLETE" || offer.status === "CONVERTED";
  const isApproved = offer.status === "APPROVED";
  const canRespond = ["SENT", "VIEWED"].includes(offer.status);

  return (
    <div className="min-h-dvh px-4 py-8">
      <div className="max-w-xl w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl mb-3">
            <Briefcase className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Bazaar Printing</h1>
          <p className="text-muted-foreground text-sm">Job Offer Letter</p>
        </div>

        {/* Offer card */}
        <Card className="shadow-sm">
          <CardContent className="py-6 px-6 space-y-5">
            <div>
              <p className="text-muted-foreground text-sm mb-1">
                Dear {offer.candidateFirst} {offer.candidateLast},
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                We are pleased to offer you the following position at{" "}
                <strong>Bazaar Printing</strong>. Please review the details below and let us know
                your decision.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 border rounded-lg overflow-hidden">
              <div className="flex items-start gap-3 px-4 py-3 border-b">
                <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Position</p>
                  <p className="font-semibold text-slate-800">{offer.jobTitle}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 px-4 py-3 border-b">
                <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Compensation</p>
                  <p className="font-medium text-slate-800">
                    {formatPay(offer.payType, offer.payRate, offer.payFrequency)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 px-4 py-3 border-b">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Start Date</p>
                  <p className="font-medium text-slate-800">
                    {format(new Date(offer.startDate), "MMMM d, yyyy")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 px-4 py-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Work Type</p>
                  <p className="font-medium text-slate-800">
                    {WORK_TYPE_LABELS[offer.workType] ?? offer.workType}
                  </p>
                </div>
              </div>
            </div>

            {offer.notes && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Additional Notes
                </p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{offer.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* State-based call to action */}
        {canRespond && (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700 h-12 text-base"
              onClick={handleAccept}
              disabled={acting}
            >
              {acting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Accept Offer
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-12 text-base border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => setDeclineOpen(true)}
              disabled={acting}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Decline
            </Button>
          </div>
        )}

        {isApproved && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-4 px-5 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-medium text-amber-800 text-sm">Offer Accepted</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Please complete your intake form to finalize your start.
                </p>
              </div>
              <Button
                size="sm"
                className="ml-auto bg-amber-600 hover:bg-amber-700 shrink-0"
                onClick={() => router.push(`/candidate/${token}/intake`)}
              >
                Complete Form
              </Button>
            </CardContent>
          </Card>
        )}

        {intakeDone && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="py-4 px-5 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="font-medium text-green-800 text-sm">All done!</p>
                <p className="text-xs text-green-700 mt-0.5">
                  {isConverted
                    ? "Your employee account has been created. Check your work email for login details."
                    : "Your intake form has been received. HR will be in touch shortly."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {isDeclined && (
          <Card className="border-slate-200 bg-slate-50">
            <CardContent className="py-4 px-5 flex items-center gap-3">
              <XCircle className="h-5 w-5 text-slate-400 shrink-0" />
              <div>
                <p className="font-medium text-slate-600 text-sm">Offer Declined</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Thank you for your time. If you change your mind, please contact HR.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Bazaar Printing HR — This link is private and unique to you.
        </p>
      </div>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline this offer?</DialogTitle>
            <DialogDescription>
              Are you sure you want to decline the offer for <strong>{offer.jobTitle}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={acting} onClick={() => setDeclineOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDecline}
              disabled={acting}
            >
              Yes, decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
