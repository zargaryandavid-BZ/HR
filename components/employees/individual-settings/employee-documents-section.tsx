"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Info, Plus, Send } from "lucide-react";
import { AssignDocumentModal } from "@/components/employees/assign-document-modal";
import { SendForSignatureDialog } from "@/components/employees/send-for-signature-dialog";
import { EmployeeDocumentRow } from "@/components/employees/individual-settings/employee-document-row";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
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
  const sendableCount = allDocs.filter((doc) => !isDocumentHrConfirmed(doc.status)).length;
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
              disabled={sendableCount === 0}
              title={sendableCount === 0 ? "All documents are HR approved" : undefined}
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
          <EmployeeDocumentRow
            key={doc.id}
            doc={doc}
            mode={mode}
            employeeId={employeeId}
            assignmentContext="onboarding"
            showAssignmentTags={showAssignmentTags}
            onMutationSuccess={onMutationSuccess}
            onToast={onToast}
          />
        ))}
      </div>
    </div>
  );
}
