"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { formatDisplayDate } from "@/lib/dates";
import { AlertTriangle, Loader2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  isWriteUpConfirmationValid,
  WRITEUP_CONFIRMATION_PHRASE,
} from "@/lib/writeups/constants";

export type WriteUpAcknowledgeTarget = {
  id: string;
  number: number;
  category: string;
  categoryLabel: string;
  date: string;
  description: string;
  consequence: string | null;
  issuedByName: string;
  attachmentUrl: string | null;
};

type WriteUpAcknowledgeModalProps = {
  writeUp: WriteUpAcknowledgeTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (result: { acknowledgedAt: string; acknowledgedBy: string }) => void;
};

/** Modal for employees to type-confirm acknowledgment of a disciplinary write-up */
export function WriteUpAcknowledgeModal({
  writeUp,
  open,
  onOpenChange,
  onSuccess,
}: WriteUpAcknowledgeModalProps) {
  const [confirmationInput, setConfirmationInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const phraseMatches = isWriteUpConfirmationValid(confirmationInput);

  useEffect(() => {
    if (!open) {
      setConfirmationInput("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!writeUp || !phraseMatches || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/employee/write-ups/${writeUp.id}/acknowledge`, {
        method: "PATCH",
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? "Failed to acknowledge write-up");
      }

      onSuccess({
        acknowledgedAt: json.data.acknowledgedAt,
        acknowledgedBy: json.data.acknowledgedBy,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to acknowledge write-up");
    } finally {
      setSubmitting(false);
    }
  };

  if (!writeUp) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Write-up #{writeUp.number} — {writeUp.categoryLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2">
            <dt className="text-muted-foreground">Date</dt>
            <dd>{formatDisplayDate(writeUp.date)}</dd>
            <dt className="text-muted-foreground">Category</dt>
            <dd>{writeUp.categoryLabel}</dd>
            <dt className="text-muted-foreground">Issued by</dt>
            <dd>{writeUp.issuedByName}</dd>
          </dl>

          <div className="rounded-md border bg-muted/30 p-3 max-h-48 overflow-y-auto text-sm leading-relaxed">
            <p className="whitespace-pre-wrap">{writeUp.description}</p>
            {writeUp.consequence && (
              <p className="mt-2 text-muted-foreground">
                <span className="font-medium text-foreground">Consequence: </span>
                {writeUp.consequence}
              </p>
            )}
          </div>

          {writeUp.attachmentUrl && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                Attachment
              </p>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={writeUp.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View attachment
                </a>
              </Button>
            </div>
          )}

          <div className="border-t pt-4 space-y-3">
            <div>
              <p className="text-sm">
                To acknowledge, type exactly:{" "}
                <span className="font-mono font-bold">
                  &quot;{WRITEUP_CONFIRMATION_PHRASE}&quot;
                </span>
              </p>
              <Input
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder="Type the phrase above…"
                className="mt-2"
                disabled={submitting}
                autoComplete="off"
              />
            </div>

            <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Acknowledging this write-up confirms you have received and read it. It
                does not mean you agree with its contents.
              </p>
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!phraseMatches || submitting}
            className={cn(!phraseMatches && "opacity-50")}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit acknowledgment"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
