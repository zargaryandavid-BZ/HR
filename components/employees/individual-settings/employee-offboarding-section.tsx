"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Download, Plus, Send } from "lucide-react";
import type { DocumentType } from "@prisma/client";
import { DocumentTypeBadge } from "@/components/documents/document-type-badge";
import { AssignOffboardingDocumentModal } from "@/components/employees/assign-offboarding-document-modal";
import { SendOffboardingSignatureDialog } from "@/components/employees/send-offboarding-signature-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { EmployeeDocumentStatusItem } from "@/lib/individual-settings/constants";
import { cn } from "@/lib/utils";

type OffboardingResponse = {
  autoAssigned: EmployeeDocumentStatusItem[];
  manuallyAssigned: EmployeeDocumentStatusItem[];
  instance: {
    id: string;
    lastDayDate: string | null;
    initiatedAt: string;
    status: string;
  } | null;
};

type EmployeeOffboardingSectionProps = {
  employeeId: string;
  employeeName: string;
  employeeStatus: string;
  onToast?: (message: string) => void;
};

/** Offboarding docs tab — assign, send, and track exit documents */
export function EmployeeOffboardingSection({
  employeeId,
  employeeName,
  employeeStatus,
  onToast,
}: EmployeeOffboardingSectionProps) {
  const queryClient = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [lastDayInput, setLastDayInput] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["employee-offboarding-docs", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/offboarding-docs`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load offboarding documents");
      return json.data as OffboardingResponse;
    },
  });

  const lastDayMutation = useMutation({
    mutationFn: async (lastDayDate: string) => {
      const res = await fetch(`/api/employees/${employeeId}/offboarding-instance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastDayDate: lastDayDate || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Failed to save last day");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-offboarding-docs", employeeId] });
      onToast?.("Last day saved");
    },
    onError: (e: Error) => onToast?.(e.message),
  });

  const autoAssigned = data?.autoAssigned ?? [];
  const manuallyAssigned = data?.manuallyAssigned ?? [];
  const allDocs = [...autoAssigned, ...manuallyAssigned];
  const unsentCount = allDocs.filter((doc) => !doc.assignmentSentAt).length;
  const hasStarted = Boolean(data?.instance) || employeeStatus === "INACTIVE";
  const instanceLastDay = data?.instance?.lastDayDate
    ? data.instance.lastDayDate.slice(0, 10)
    : "";

  useEffect(() => {
    if (instanceLastDay) {
      setLastDayInput(instanceLastDay);
    }
  }, [instanceLastDay]);

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Offboarding Docs</h2>
          <p className="text-sm text-muted-foreground">
            Offboarding documents for this employee&apos;s exit process
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Assign Document
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={unsentCount === 0}
            onClick={() => setSendOpen(true)}
          >
            <Send className="h-4 w-4 mr-1" />
            Send for Signature
          </Button>
        </div>
      </div>

      <AssignOffboardingDocumentModal
        open={assignOpen}
        onOpenChange={setAssignOpen}
        employeeId={employeeId}
        employeeName={employeeName}
        onSuccess={(message) => onToast?.(message)}
      />
      <SendOffboardingSignatureDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        employeeId={employeeId}
        employeeName={employeeName}
        onSuccess={(message) => onToast?.(message)}
      />

      {data?.instance && (
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-sm font-medium" htmlFor="lastDayDate">
              Last day
            </label>
            <Input
              id="lastDayDate"
              type="date"
              className="mt-1 w-48"
              value={lastDayInput || instanceLastDay}
              onChange={(e) => setLastDayInput(e.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={lastDayMutation.isPending}
            onClick={() => lastDayMutation.mutate(lastDayInput || instanceLastDay)}
          >
            Save last day
          </Button>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : isError ? (
        <p className="text-sm text-destructive">Failed to load offboarding documents.</p>
      ) : !hasStarted && allDocs.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">This employee has not been deactivated yet.</p>
          <p>
            Offboarding documents will be auto-assigned when you deactivate this employee. You can
            also pre-assign documents using &quot;+ Assign Document&quot; above.
          </p>
        </div>
      ) : allDocs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No offboarding documents assigned yet. Use &quot;+ Assign Document&quot; or deactivate to
          trigger position automation.
        </p>
      ) : (
        <div className="space-y-6">
          {autoAssigned.length > 0 && (
            <DocGroup label="Auto-assigned" badgeClass="bg-blue-100 text-blue-800" docs={autoAssigned} />
          )}
          {manuallyAssigned.length > 0 && (
            <DocGroup
              label="Manually assigned"
              badgeClass="bg-green-100 text-green-800"
              docs={manuallyAssigned}
            />
          )}
        </div>
      )}
    </section>
  );
}

function DocGroup({
  label,
  badgeClass,
  docs,
}: {
  label: string;
  badgeClass: string;
  docs: EmployeeDocumentStatusItem[];
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
        <span className="text-xs text-muted-foreground">{docs.length} total</span>
      </div>
      <div className="space-y-2">
        {docs.map((doc) => (
          <Card key={doc.id}>
            <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <DocumentTypeBadge type={doc.documentType as DocumentType} />
                <div>
                  <p className="font-semibold truncate">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">v{doc.version}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 mr-1" />
                    View
                  </a>
                </Button>
                <span className="text-xs text-muted-foreground">
                  {doc.assignmentSentAt
                    ? `Sent ${format(parseISO(doc.assignmentSentAt), "MMM d, yyyy")}`
                    : "Not sent"}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
