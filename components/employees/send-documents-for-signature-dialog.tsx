"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { DocumentCompletionStatus } from "@/lib/individual-settings/constants";
import { cn } from "@/lib/utils";

export type SendableDocument = {
  id: string;
  title: string;
  status: DocumentCompletionStatus;
  alreadySent: boolean;
};

const STATUS_LABELS: Record<DocumentCompletionStatus, string> = {
  not_started: "Not started",
  downloaded: "Downloaded",
  acknowledged: "Acknowledged",
  signature_required: "Awaiting signature",
  signed: "Signed — awaiting HR",
  hr_approved: "HR approved",
};

type SendDocumentsForSignatureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  onSuccess: (message: string) => void;
  sendApiPath: string;
  queryKey: string[];
  invalidateQueryKeys: string[][];
  dialogTitle?: string;
};

/** Dialog to select which non-HR-approved documents to send for signature */
export function SendDocumentsForSignatureDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  onSuccess,
  sendApiPath,
  queryKey,
  invalidateQueryKeys,
  dialogTitle = "Send documents for signature",
}: SendDocumentsForSignatureDialogProps) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendError, setSendError] = useState<string | null>(null);

  const { data: documents, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(sendApiPath);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Failed to load documents");
      return json.data as SendableDocument[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
      setSendError(null);
      return;
    }
    if (documents?.length) {
      setSelectedIds(new Set(documents.map((doc) => doc.id)));
    }
  }, [open, documents]);

  const sendMutation = useMutation({
    mutationFn: async (documentIds: string[]) => {
      const res = await fetch(sendApiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Failed to send documents");
      return json.data as { sent: number; employeeName: string };
    },
    onSuccess: (result) => {
      setSendError(null);
      for (const key of invalidateQueryKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      onOpenChange(false);
      onSuccess(
        `${result.sent} document${result.sent !== 1 ? "s" : ""} sent to ${result.employeeName}`
      );
    },
    onError: (error: Error) => {
      setSendError(error.message);
    },
  });

  const totalCount = documents?.length ?? 0;
  const selectedCount = selectedIds.size;
  const allSelected = totalCount > 0 && selectedCount === totalCount;

  function toggleDocument(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (checked && documents) {
      setSelectedIds(new Set(documents.map((doc) => doc.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSendError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading documents...</p>
        ) : totalCount === 0 ? (
          <p className="text-sm text-muted-foreground">
            All documents are HR approved — nothing to send.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Select documents to send to <strong>{employeeName}</strong>&apos;s portal. All
              non-HR-approved files are selected by default.
            </p>

            <div className="flex items-center gap-2 border-b pb-2">
              <Checkbox
                id="select-all-docs"
                checked={allSelected}
                onCheckedChange={(checked) => toggleAll(checked === true)}
              />
              <Label htmlFor="select-all-docs" className="text-sm font-medium cursor-pointer">
                Select all ({totalCount})
              </Label>
            </div>

            <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {documents?.map((doc) => {
                const checked = selectedIds.has(doc.id);
                const inputId = `send-doc-${doc.id}`;
                return (
                  <li
                    key={doc.id}
                    className={cn(
                      "flex items-start gap-3 rounded-md border px-3 py-2.5",
                      checked ? "border-primary/30 bg-primary/5" : "border-border"
                    )}
                  >
                    <Checkbox
                      id={inputId}
                      className="mt-0.5"
                      checked={checked}
                      onCheckedChange={(value) => toggleDocument(doc.id, value === true)}
                    />
                    <Label htmlFor={inputId} className="flex-1 cursor-pointer space-y-0.5">
                      <span className="block text-sm font-medium leading-snug">{doc.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {STATUS_LABELS[doc.status]}
                        {doc.alreadySent ? " · Previously sent" : " · Not yet sent"}
                      </span>
                    </Label>
                  </li>
                );
              })}
            </ul>

            <p className="text-xs text-muted-foreground">
              The employee will receive a notification for the selected documents.
            </p>
          </div>
        )}

        {sendError && <p className="text-sm text-destructive">{sendError}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={selectedCount === 0 || sendMutation.isPending}
            onClick={() => sendMutation.mutate([...selectedIds])}
          >
            <Send className="h-4 w-4 mr-1" />
            {sendMutation.isPending
              ? "Sending..."
              : `Send ${selectedCount} document${selectedCount !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
