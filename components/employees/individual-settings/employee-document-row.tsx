"use client";

import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  MoreHorizontal,
  Upload,
} from "lucide-react";
import type { DocumentType } from "@prisma/client";
import { DocumentTypeBadge } from "@/components/documents/document-type-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import {
  getDocumentDownloadUrl,
  type DocumentCompletionStatus,
  type EmployeeDocumentStatusItem,
} from "@/lib/individual-settings/constants";
import { cn } from "@/lib/utils";

export type DocumentAssignmentContext = "onboarding" | "offboarding";

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

type EmployeeDocumentRowProps = {
  doc: EmployeeDocumentStatusItem;
  mode: "admin" | "employee";
  employeeId: string;
  assignmentContext: DocumentAssignmentContext;
  showAssignmentTags?: boolean;
  onMutationSuccess: () => void;
  onToast?: (message: string) => void;
};

/** Shared document row with HR admin actions (approve, replace, remove) */
export function EmployeeDocumentRow({
  doc,
  mode,
  employeeId,
  assignmentContext,
  showAssignmentTags = false,
  onMutationSuccess,
  onToast,
}: EmployeeDocumentRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const status = STATUS_CONFIG[doc.status];
  const sentAwaitingAction =
    mode === "admin" &&
    doc.assignmentSentAt &&
    doc.status === "not_started";
  const workflowStatus = sentAwaitingAction
    ? {
        label: "Sent — awaiting action",
        className: "bg-amber-100 text-amber-800 border-amber-200",
      }
    : status;
  const { role } = useCurrentUser();
  const isHrAdmin =
    mode === "admin" && ["HR_ADMIN", "SUPER_ADMIN"].includes(role ?? "");
  const isHrApproved = doc.status === "hr_approved";
  const downloadUrl = getDocumentDownloadUrl(doc);
  const isOffboarding = assignmentContext === "offboarding";

  const removeUrl =
    assignmentContext === "offboarding"
      ? `/api/employees/${employeeId}/offboarding-docs?documentId=${doc.id}`
      : `/api/employees/${employeeId}/onboarding-docs?documentId=${doc.id}`;

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const uploadPath =
        assignmentContext === "offboarding"
          ? `/api/employee/offboarding-documents/${doc.id}/upload`
          : `/api/employee/documents/${doc.id}/upload`;
      const res = await fetch(uploadPath, { method: "POST", body: formData });
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
          body: JSON.stringify({ approved, isOffboarding }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? json.message ?? "Failed to update approval");
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
      const query = isOffboarding ? "?isOffboarding=true" : "";
      const res = await fetch(
        `/api/employees/${employeeId}/documents/${doc.id}/replace-file${query}`,
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
      const res = await fetch(removeUrl, { method: "DELETE" });
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
