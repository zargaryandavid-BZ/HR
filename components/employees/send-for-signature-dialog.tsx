"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type UnsentDocument = {
  id: string;
  title: string;
};

type SendForSignatureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  onSuccess: (message: string) => void;
};

/** Confirmation dialog before sending unsent onboarding docs to the employee portal */
export function SendForSignatureDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  onSuccess,
}: SendForSignatureDialogProps) {
  const queryClient = useQueryClient();

  const { data: unsentDocs, isLoading } = useQuery({
    queryKey: ["unsent-onboarding-docs", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/onboarding-docs/send`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Failed to load documents");
      return json.data as UnsentDocument[];
    },
    enabled: open,
  });

  const [sendError, setSendError] = useState<string | null>(null);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/onboarding-docs/send`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Failed to send documents");
      return json.data as { sent: number; employeeName: string };
    },
    onSuccess: (result) => {
      setSendError(null);
      queryClient.invalidateQueries({ queryKey: ["employee-settings-documents", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["unsent-onboarding-docs", employeeId] });
      onOpenChange(false);
      onSuccess(
        `${result.sent} document${result.sent !== 1 ? "s" : ""} sent to ${result.employeeName}`
      );
    },
    onError: (error: Error) => {
      setSendError(error.message);
    },
  });

  const count = unsentDocs?.length ?? 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSendError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send documents for signature?</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading documents...</p>
        ) : count === 0 ? (
          <p className="text-sm text-muted-foreground">No unsent documents to send.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              The following documents will be sent to{" "}
              <strong>{employeeName}</strong>&apos;s portal for review and signature:
            </p>
            <ul className="text-sm list-disc pl-5 space-y-1 max-h-48 overflow-y-auto">
              {unsentDocs?.map((doc) => (
                <li key={doc.id}>{doc.title}</li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              The employee will receive a notification.
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
            disabled={count === 0 || sendMutation.isPending}
            onClick={() => sendMutation.mutate()}
          >
            <Send className="h-4 w-4 mr-1" />
            {sendMutation.isPending ? "Sending..." : `Send ${count} document${count !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
