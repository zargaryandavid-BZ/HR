"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { AlertCircle, CheckCircle2, Download, ExternalLink, Info, MoreHorizontal, Plus, Send, Upload } from "lucide-react";
import type { DocumentType } from "@prisma/client";
import { DocumentTypeBadge } from "@/components/documents/document-type-badge";
import { AssignDocumentModal } from "@/components/employees/assign-document-modal";
import { SendForSignatureDialog } from "@/components/employees/send-for-signature-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import {
  getDocumentDownloadUrl,
  isDocumentHrConfirmed,
  type DocumentCompletionStatus,
  type EmployeeDocumentStatusItem,
} from "@/lib/individual-settings/constants";
import { cn } from "@/lib/utils";

type DocumentsResponse = {
  companyWide: EmployeeDocumentStatusItem[];
  assigned: EmployeeDocumentStatusItem[];
};

/** Whether the document still needs HR confirmation */
function isDocumentPending(status: DocumentCompletionStatus): boolean {
  return !isDocumentHrConfirmed(status);
}

/** Tab badge — shows when employee has incomplete onboarding documents */
export function OnboardingDocsPendingBadge({ employeeId }: { employeeId: string }) {
  const { data } = useQuery({
    queryKey: ["employee-settings-documents", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/documents`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load documents");
      return json.data as DocumentsResponse;
    },
  });

  const allDocs = [...(data?.companyWide ?? []), ...(data?.assigned ?? [])];
  const pendingCount = allDocs.filter(
    (doc) => doc.assignmentSentAt && isDocumentPending(doc.status)
  ).length;
  if (pendingCount === 0) return null;

  return (
    <span
      className="inline-flex items-center gap-0.5"
      title={`${pendingCount} onboarding document${pendingCount !== 1 ? "s" : ""} awaiting HR confirmation`}
    >
      <AlertCircle className="h-3.5 w-3.5 text-amber-600" aria-hidden />
      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-100 px-1 text-[10px] font-bold text-amber-700">
        {pendingCount}
      </span>
    </span>
  );
}

type EmployeeDocumentsSectionProps = {
  employeeId: string;
  employeeName?: string;
  positionName?: string;
  hasPositionAutomation?: boolean;
  mode: "admin" | "employee";
  onToast?: (message: string) => void;
};

const STATUS_CONFIG: Record<
  DocumentCompletionStatus,
  { label: string; className: string }
> = {
  not_started: {
    label: "Not started",
    className: "bg-red-100 text-red-800 border-red-200",
  },
  downloaded: {
    label: "Downloaded",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  acknowledged: {
    label: "Acknowledged",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  signature_required: {
    label: "Signature required",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  signed: {
    label: "Signed",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  hr_approved: {
    label: "HR Approved",
    className: "bg-green-100 text-green-800 border-green-200",
  },
};

/** Onboarding Docs section showing company-wide and assigned docs with completion status */
export function EmployeeDocumentsSection({
  employeeId,
  employeeName = "Employee",
  positionName = "this position",
  hasPositionAutomation = false,
  mode,
  onToast,
}: EmployeeDocumentsSectionProps) {
  const queryClient = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["employee-settings-documents", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/documents`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load documents");
      return json.data as DocumentsResponse;
    },
  });

  const invalidateDocs = () => {
    queryClient.invalidateQueries({
      queryKey: ["employee-settings-documents", employeeId],
    });
    queryClient.invalidateQueries({
      queryKey: ["available-documents", employeeId],
    });
    queryClient.invalidateQueries({
      queryKey: ["unsent-onboarding-docs", employeeId],
    });
  };

  const companyWide = data?.companyWide ?? [];
  const assigned = data?.assigned ?? [];
  const totalDocs = companyWide.length + assigned.length;
  const isEmpty = totalDocs === 0;
  const isAdmin = mode === "admin";
  const allDocs = [...companyWide, ...assigned];
  const unsentCount = allDocs.filter((doc) => !doc.assignmentSentAt).length;
  const hasManualAssignment = allDocs.some((doc) => doc.assignedManually);
  const anySent = allDocs.some((doc) => doc.assignmentSentAt);
  const showNoAutomationBanner =
    isAdmin &&
    !hasPositionAutomation &&
    !hasManualAssignment &&
    !anySent &&
    totalDocs > 0;

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Onboarding Docs</h2>
          <p className="text-sm text-muted-foreground">
            Onboarding documents assigned to this employee
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Assign Document
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={unsentCount === 0}
              title={unsentCount === 0 ? "All documents already sent" : undefined}
              onClick={() => setSendOpen(true)}
            >
              <Send className="h-4 w-4 mr-1" />
              Send for Signature
            </Button>
          </div>
        )}
      </div>

      {isAdmin && (
        <>
          <AssignDocumentModal
            open={assignOpen}
            onOpenChange={setAssignOpen}
            employeeId={employeeId}
            employeeName={employeeName}
            onSuccess={(message) => onToast?.(message)}
          />
          <SendForSignatureDialog
            open={sendOpen}
            onOpenChange={setSendOpen}
            employeeId={employeeId}
            employeeName={employeeName}
            onSuccess={(message) => onToast?.(message)}
          />
        </>
      )}

      {showNoAutomationBanner && (
        <div className="mb-4 flex gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            No onboarding automation is set up for the <strong>{positionName}</strong> position.
            Use &quot;+ Assign Document&quot; to add role-specific documents manually, then click
            &quot;Send for Signature&quot; when ready. Or set up an automation in Onboarding →
            Automation.
          </p>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : isError ? (
        <p className="text-sm text-destructive">Failed to load documents.</p>
      ) : isEmpty ? (
        <p className="text-sm text-muted-foreground">
          No documents assigned yet. Click &quot;Assign Document&quot; to add onboarding docs,
          then &quot;Send for Signature&quot; when ready.
        </p>
      ) : (
        <div className="space-y-6">
          <DocumentGroup
            label="Company-wide"
            badgeClass="bg-blue-100 text-blue-800 border-blue-200"
            documents={companyWide}
            mode={mode}
            employeeId={employeeId}
            onMutationSuccess={invalidateDocs}
            onToast={onToast}
          />
          {assigned.length > 0 && (
            <DocumentGroup
              label="Position-assigned"
              badgeClass="bg-green-100 text-green-800 border-green-200"
              documents={assigned}
              mode={mode}
              employeeId={employeeId}
              onMutationSuccess={invalidateDocs}
              onToast={onToast}
              showAssignmentTags
            />
          )}
        </div>
      )}
    </section>
  );
}

function DocumentGroup({
  label,
  badgeClass,
  documents,
  mode,
  employeeId,
  onMutationSuccess,
  onToast,
  showAssignmentTags = false,
}: {
  label: string;
  badgeClass: string;
  documents: EmployeeDocumentStatusItem[];
  mode: "admin" | "employee";
  employeeId: string;
  onMutationSuccess: () => void;
  onToast?: (message: string) => void;
  showAssignmentTags?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
            badgeClass
          )}
        >
          {label}
        </span>
        <span className="text-xs text-muted-foreground">{documents.length} total</span>
      </div>
      <div className="space-y-2">
        {documents.map((doc) => (
          <DocumentRow
            key={doc.id}
            doc={doc}
            mode={mode}
            employeeId={employeeId}
            showAssignmentTags={showAssignmentTags}
            onMutationSuccess={onMutationSuccess}
            onToast={onToast}
          />
        ))}
      </div>
    </div>
  );
}

function DocumentRow({
  doc,
  mode,
  employeeId,
  showAssignmentTags,
  onMutationSuccess,
  onToast,
}: {
  doc: EmployeeDocumentStatusItem;
  mode: "admin" | "employee";
  employeeId: string;
  showAssignmentTags: boolean;
  onMutationSuccess: () => void;
  onToast?: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const status = STATUS_CONFIG[doc.status];
  const sentAwaitingAction =
    mode === "admin" &&
    doc.assignmentSentAt &&
    doc.status === "not_started";
  const workflowStatus = sentAwaitingAction
    ? { label: "Sent — awaiting action", className: "bg-amber-100 text-amber-800 border-amber-200" }
    : status;
  const { role } = useCurrentUser();
  const isHrAdmin = mode === "admin" && ["HR_ADMIN", "SUPER_ADMIN"].includes(role ?? "");
  const isHrApproved = doc.status === "hr_approved";
  const downloadUrl = getDocumentDownloadUrl(doc);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/employee/documents/${doc.id}/upload`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
    },
    onSuccess: () => {
      onMutationSuccess();
      onToast?.("Signed copy uploaded");
    },
    onError: (e: Error) => onToast?.(e.message),
  });

  const approveMutation = useMutation({
    mutationFn: async (approved: boolean) => {
      const res = await fetch(
        `/api/employees/${employeeId}/documents/${doc.id}/approve`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approved }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update approval");
    },
      onSuccess: (_data, approved) => {
      onMutationSuccess();
      onToast?.(
        approved
          ? "Document marked as HR Approved"
          : "Approval removed — status reset to Not started"
      );
    },
    onError: (e: Error) => onToast?.(e.message),
  });

  const replaceFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(
        `/api/employees/${employeeId}/documents/${doc.id}/replace-file`,
        { method: "POST", body: formData }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Upload failed");
    },
    onSuccess: () => {
      onMutationSuccess();
      onToast?.("File replaced");
    },
    onError: (e: Error) => onToast?.(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/employees/${employeeId}/onboarding-docs?documentId=${doc.id}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Failed to remove document");
    },
    onSuccess: () => {
      onMutationSuccess();
      onToast?.("Document removed");
    },
    onError: (e: Error) => onToast?.(e.message),
  });

  const sentLabel = doc.assignmentSentAt
    ? `Sent ${format(parseISO(doc.assignmentSentAt), "MMM d, yyyy")}`
    : null;

  return (
    <Card>
      <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <DocumentTypeBadge type={doc.documentType as DocumentType} />
          <div className="min-w-0">
            <p className="font-semibold truncate">{doc.title}</p>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <p className="text-xs text-muted-foreground">v{doc.version}</p>
              {showAssignmentTags &&
                doc.assignmentTags.map((tag) => (
                  <span
                    key={`${tag.kind}-${tag.id}`}
                    className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs"
                  >
                    {tag.label}
                  </span>
                ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {mode === "admin" && (
            <Button variant="outline" size="sm" asChild>
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-1" />
                View
              </a>
            </Button>
          )}

          {mode === "employee" && (
            <>
              <Button variant="outline" size="sm" asChild>
                <a href={downloadUrl} download target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </a>
              </Button>
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
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploadMutation.isPending}
                    onClick={() => inputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Upload signed copy
                  </Button>
                </>
              )}
            </>
          )}

          {(doc.status === "signed" || doc.status === "hr_approved") && doc.signedFileUrl && (
            <a
              href={doc.signedFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              {mode === "employee" ? "View my signed copy" : "View signed copy"}
            </a>
          )}

          {mode === "employee" && doc.signedFileUrl && (
            <span className="inline-flex items-center gap-1 text-xs text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Uploaded
            </span>
          )}

          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
              doc.assignmentSentAt
                ? "bg-muted text-muted-foreground border-muted-foreground/20"
                : "bg-gray-100 text-gray-700 border-gray-200"
            )}
          >
            {doc.assignmentSentAt ? sentLabel : "Not sent"}
          </span>

          {doc.assignmentSentAt && (
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                workflowStatus.className
              )}
            >
              {workflowStatus.label}
            </span>
          )}

          {isHrAdmin && (
            <>
              {/* hidden file input for Replace File */}
              <input
                ref={replaceRef}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) replaceFileMutation.mutate(file);
                  e.target.value = "";
                }}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={
                      approveMutation.isPending ||
                      replaceFileMutation.isPending ||
                      removeMutation.isPending
                    }
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Document actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isHrApproved ? (
                    <DropdownMenuItem onClick={() => approveMutation.mutate(false)}>
                      Remove Approval
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => approveMutation.mutate(true)}>
                      Mark as HR Approved
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => replaceRef.current?.click()}>
                    Replace File
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    disabled={removeMutation.isPending}
                    onClick={() => {
                      if (
                        confirm(
                          `Remove "${doc.title}" from this employee? This clears the assignment regardless of signing status. You can re-assign it later.`
                        )
                      ) {
                        removeMutation.mutate();
                      }
                    }}
                  >
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
