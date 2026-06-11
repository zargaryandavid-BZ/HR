"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, PenLine } from "lucide-react";
import type { DocumentType } from "@prisma/client";
import { DocumentTypeBadge } from "@/components/documents/document-type-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeDocumentActions } from "./employee-document-actions";
import type {
  DocumentCompletionStatus,
  EmployeeDocumentStatusItem,
} from "@/lib/individual-settings/constants";
import {
  employeeNeedsSignedUpload,
  isDocumentHrConfirmed,
  isDocumentSigned,
} from "@/lib/individual-settings/constants";
import { cn } from "@/lib/utils";
import { EmployeeDashboardSection } from "./employee-dashboard-section";

type DocumentsData = {
  companyWide: EmployeeDocumentStatusItem[];
  assigned: EmployeeDocumentStatusItem[];
};

const STATUS_LABEL: Record<DocumentCompletionStatus, string> = {
  not_started: "Not started",
  downloaded: "Downloaded",
  acknowledged: "Acknowledged",
  signature_required: "Signature required",
  signed: "Signed",
  hr_approved: "HR Approved",
};

const STATUS_CLASS: Record<DocumentCompletionStatus, string> = {
  not_started: "bg-red-100 text-red-800 border-red-200",
  downloaded: "bg-amber-100 text-amber-800 border-amber-200",
  acknowledged: "bg-blue-100 text-blue-800 border-blue-200",
  signature_required: "bg-amber-100 text-amber-800 border-amber-200",
  signed: "bg-green-100 text-green-800 border-green-200",
  hr_approved: "bg-green-100 text-green-800 border-green-200",
};

/** Section 4 — Onboarding Documents */
export function EmployeeOnboardingSection() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<DocumentsData>({
    queryKey: ["employee-onboarding-docs"],
    queryFn: async () => {
      const res = await fetch("/api/employee/documents");
      const json = await res.json();
      return json.data;
    },
  });

  const allDocs = [...(data?.companyWide ?? []), ...(data?.assigned ?? [])];
  const total = allDocs.length;
  const signedCount = allDocs.filter((d) => isDocumentSigned(d.status)).length;
  const approvedCount = allDocs.filter((d) => isDocumentHrConfirmed(d.status)).length;
  const needsAction = allDocs.filter((d) => employeeNeedsSignedUpload(d.status)).length;
  const awaitingHrCount = signedCount - approvedCount;

  const approvedPct = total > 0 ? (approvedCount / total) * 100 : 0;
  const signedPendingPct = total > 0 ? (awaitingHrCount / total) * 100 : 0;
  const signedPct = total > 0 ? (signedCount / total) * 100 : 0;

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <EmployeeDashboardSection
      title={`Onboarding Documents (${total})`}
      defaultOpen={false}
      contentClassName="space-y-4"
      actions={
        needsAction > 0 ? (
          <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 text-xs font-medium">
            {needsAction} to sign
          </span>
        ) : approvedCount === total && total > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            All approved
          </span>
        ) : null
      }
    >
      {total > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <DocumentStatBar
              label="Total"
              count={total}
              pct={100}
              barClass="bg-slate-400"
              textClass="text-slate-700"
            />
            <DocumentStatBar
              label="Signed"
              count={signedCount}
              pct={signedPct}
              barClass="bg-blue-500"
              textClass="text-blue-800"
            />
            <DocumentStatBar
              label="Approved"
              count={approvedCount}
              pct={approvedPct}
              barClass="bg-green-500"
              textClass="text-green-800"
            />
          </div>

          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden flex">
            {approvedPct > 0 && (
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${approvedPct}%` }}
                title={`${approvedCount} approved`}
              />
            )}
            {signedPendingPct > 0 && (
              <div
                className="h-full bg-amber-400 transition-all"
                style={{ width: `${signedPendingPct}%` }}
                title={`${awaitingHrCount} signed, awaiting HR`}
              />
            )}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Approved ({approvedCount})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Signed, awaiting HR ({awaitingHrCount})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
              Remaining ({total - signedCount})
            </span>
          </div>
        </div>
      )}

      {total === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No onboarding documents assigned yet.
        </p>
      ) : (
        <div className="divide-y border rounded-lg">
          {allDocs.map((doc) => (
            <OnboardingDocRow
              key={doc.id}
              doc={doc}
              onUploadSuccess={() =>
                queryClient.invalidateQueries({ queryKey: ["employee-onboarding-docs"] })
              }
            />
          ))}
        </div>
      )}
    </EmployeeDashboardSection>
  );
}

function DocumentStatBar({
  label,
  count,
  pct,
  barClass,
  textClass,
}: {
  label: string;
  count: number;
  pct: number;
  barClass: string;
  textClass: string;
}) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className={cn("text-lg font-semibold leading-none", textClass)}>{count}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", barClass)}
          style={{ width: `${Math.min(100, Math.round(pct))}%` }}
        />
      </div>
    </div>
  );
}

function OnboardingDocRow({
  doc,
  onUploadSuccess,
}: {
  doc: EmployeeDocumentStatusItem;
  onUploadSuccess: () => void;
}) {
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/employee/documents/${doc.id}/upload`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Upload failed");
      return json.message as string;
    },
    onSuccess: (msg) => {
      setErrorMsg(null);
      setToastMsg(msg);
      onUploadSuccess();
      setTimeout(() => setToastMsg(null), 3000);
    },
    onError: (err: Error) => {
      setToastMsg(null);
      setErrorMsg(err.message);
    },
  });

  const status = doc.status;

  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 flex items-center gap-2 overflow-hidden">
          <span className="font-medium text-sm truncate min-w-0 flex-1">{doc.title}</span>
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0 text-[10px] font-medium shrink-0",
              STATUS_CLASS[status]
            )}
          >
            {status === "signature_required" && <PenLine className="h-2.5 w-2.5" />}
            {STATUS_LABEL[status]}
          </span>
          <DocumentTypeBadge
            type={doc.documentType as DocumentType}
            className="text-[10px] px-1.5 py-0 shrink-0"
          />
          <span className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">
            Signed on: {doc.signedAt ? format(new Date(doc.signedAt), "MM/dd/yy") : "—"}
          </span>
        </div>

        <EmployeeDocumentActions
          fileUrl={doc.fileUrl}
          signedFileUrl={doc.signedFileUrl}
          status={status}
          uploading={uploadMutation.isPending}
          onUpload={(file) => uploadMutation.mutate(file)}
        />
      </div>

      {(toastMsg || errorMsg) && (
        <p className={cn("text-[11px] mt-1", errorMsg ? "text-destructive" : "text-green-700")}>
          {errorMsg ?? toastMsg}
        </p>
      )}
    </div>
  );
}
