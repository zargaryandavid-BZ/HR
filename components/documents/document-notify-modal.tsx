"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type DocumentNotifyModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentTitle: string;
  version: number;
  assignedCount: number;
  documentId: string;
  onComplete: () => void;
};

/** Confirmation modal to notify assigned employees of a document version update */
export function DocumentNotifyModal({
  open,
  onOpenChange,
  documentTitle,
  version,
  assignedCount,
  documentId,
  onComplete,
}: DocumentNotifyModalProps) {
  const [sending, setSending] = useState(false);

  /** Send update notifications to assigned employees */
  async function handleNotify() {
    setSending(true);
    try {
      await fetch(`/api/documents/${documentId}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      onComplete();
      onOpenChange(false);
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notify Assigned Employees?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          You have uploaded a new version (v{version}) of &apos;{documentTitle}&apos;.
          This document is currently assigned to {assignedCount} employee
          {assignedCount === 1 ? "" : "s"}. Would you like to notify them that the
          document has been updated?
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Skip
          </Button>
          <Button onClick={() => void handleNotify()} disabled={sending || assignedCount === 0}>
            {sending ? "Sending..." : "Send Notification"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
