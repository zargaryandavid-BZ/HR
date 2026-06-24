"use client";

import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDisplayDate } from "@/lib/dates";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { DocumentType } from "@prisma/client";
import { DocumentTypeBadge } from "@/components/documents/document-type-badge";
import { Skeleton } from "@/components/ui/skeleton";
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

type OffboardingData = {
  autoAssigned: EmployeeDocumentStatusItem[];
  manuallyAssigned: EmployeeDocumentStatusItem[];
  instance: { lastDayDate: string | null } | null;
};

const STATUS_LABEL: Record<DocumentCompletionStatus, string> = {
  not_started: "Not started",
  downloaded: "Downloaded",
  acknowledged: "Acknowledged",
  signature_required: "Signature required",
  signed: "Signed",
  hr_approved: "HR Approved",
};

/** Employee portal offboarding documents — visible only after HR sends */
export function EmployeeOffboardingSection() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<OffboardingData>({
    queryKey: ["employee-offboarding-docs-portal"],
    queryFn: async () => {
      const res = await fetch("/api/employee/offboarding-documents");
      const json = await res.json();
      return json.data as OffboardingData;
    },
  });

  const allDocs = [...(data?.autoAssigned ?? []), ...(data?.manuallyAssigned ?? [])];
  if (!isLoading && allDocs.length === 0) return null;

  const total = allDocs.length;
  const signedCount = allDocs.filter((d) => isDocumentSigned(d.status)).length;
  const approvedCount = allDocs.filter((d) => isDocumentHrConfirmed(d.status)).length;
  const needsAction = allDocs.filter((d) => employeeNeedsSignedUpload(d.status)).length;
  const progressPct = total > 0 ? Math.round((signedCount / total) * 100) : 0;
  const lastDayLabel = data?.instance?.lastDayDate
    ? formatDisplayDate(data.instance.lastDayDate.slice(0, 10))
    : null;

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <EmployeeDashboardSection
      title={`Offboarding Documents (${total})`}
      contentClassName="space-y-4"
      actions={
        needsAction > 0 && lastDayLabel ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" />
            Complete before {lastDayLabel}
          </span>
        ) : needsAction > 0 ? (
          <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 text-xs font-medium">
            {needsAction} to sign
          </span>
        ) : approvedCount === total ? (
          <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            All complete
          </span>
        ) : null
      }
    >
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg border p-2">
          <p className="text-muted-foreground">Total</p>
          <p className="text-lg font-semibold">{total}</p>
        </div>
        <div className="rounded-lg border p-2">
          <p className="text-muted-foreground">Signed</p>
          <p className="text-lg font-semibold text-blue-700">{signedCount}</p>
        </div>
        <div className="rounded-lg border p-2">
          <p className="text-muted-foreground">Remaining</p>
          <p className="text-lg font-semibold">{total - signedCount}</p>
        </div>
      </div>

      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground text-right">{progressPct}% signed</p>

      <div className="divide-y border rounded-lg">
        {allDocs.map((doc) => (
          <OffboardingDocRow
            key={doc.id}
            doc={doc}
            onUploadSuccess={() =>
              queryClient.invalidateQueries({ queryKey: ["employee-offboarding-docs-portal"] })
            }
          />
        ))}
      </div>
    </EmployeeDashboardSection>
  );
}

function OffboardingDocRow({
  doc,
  onUploadSuccess,
}: {
  doc: EmployeeDocumentStatusItem;
  onUploadSuccess: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/employee/offboarding-documents/${doc.id}/upload`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
    },
    onSuccess: onUploadSuccess,
  });

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-2 min-w-0">
        <DocumentTypeBadge type={doc.documentType as DocumentType} />
        <span className="font-medium text-sm truncate">{doc.title}</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-xs rounded-full border px-2 py-0.5",
            doc.status === "signed" || doc.status === "hr_approved"
              ? "bg-green-100 text-green-800 border-green-200"
              : "bg-amber-100 text-amber-800 border-amber-200"
          )}
        >
          {STATUS_LABEL[doc.status]}
        </span>
        <a
          href={doc.fileUrl}
          download
          className="text-xs text-primary hover:underline"
        >
          Download
        </a>
        {!doc.signedFileUrl && (
          <>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadMutation.mutate(file);
              }}
            />
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              disabled={uploadMutation.isPending}
              onClick={() => inputRef.current?.click()}
            >
              Upload signed
            </button>
          </>
        )}
      </div>
    </div>
  );
}
