"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Send } from "lucide-react";
import { AssignOffboardingDocumentModal } from "@/components/employees/assign-offboarding-document-modal";
import { SendOffboardingSignatureDialog } from "@/components/employees/send-offboarding-signature-dialog";
import { EmployeeDocumentRow } from "@/components/employees/individual-settings/employee-document-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { EmployeeDocumentStatusItem } from "@/lib/individual-settings/constants";
import { isDocumentHrConfirmed } from "@/lib/individual-settings/constants";
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

  const invalidateDocs = () => {
    queryClient.invalidateQueries({ queryKey: ["employee-offboarding-docs", employeeId] });
  };

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
      invalidateDocs();
      onToast?.("Last day saved");
    },
    onError: (e: Error) => onToast?.(e.message),
  });

  const autoAssigned = data?.autoAssigned ?? [];
  const manuallyAssigned = data?.manuallyAssigned ?? [];
  const allDocs = [...autoAssigned, ...manuallyAssigned];
  const sendableCount = allDocs.filter((doc) => !isDocumentHrConfirmed(doc.status)).length;
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
            disabled={sendableCount === 0}
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
            <DocGroup
              label="Auto-assigned"
              badgeClass="bg-blue-100 text-blue-800"
              docs={autoAssigned}
              employeeId={employeeId}
              onMutationSuccess={invalidateDocs}
              onToast={onToast}
            />
          )}
          {manuallyAssigned.length > 0 && (
            <DocGroup
              label="Manually assigned"
              badgeClass="bg-green-100 text-green-800"
              docs={manuallyAssigned}
              employeeId={employeeId}
              onMutationSuccess={invalidateDocs}
              onToast={onToast}
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
  employeeId,
  onMutationSuccess,
  onToast,
}: {
  label: string;
  badgeClass: string;
  docs: EmployeeDocumentStatusItem[];
  employeeId: string;
  onMutationSuccess: () => void;
  onToast?: (message: string) => void;
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
          <EmployeeDocumentRow
            key={doc.id}
            doc={doc}
            mode="admin"
            employeeId={employeeId}
            assignmentContext="offboarding"
            onMutationSuccess={onMutationSuccess}
            onToast={onToast}
          />
        ))}
      </div>
    </div>
  );
}
