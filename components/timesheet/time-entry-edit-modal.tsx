"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  entryId: string;
  clockIn: string;
  clockOut: string | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

function toDatetimeLocal(value: string): string {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString();
}

export function TimeEntryEditModal({
  entryId,
  clockIn,
  clockOut,
  open,
  onClose,
  onSaved,
}: Props) {
  const [clockInValue, setClockInValue] = useState(toDatetimeLocal(clockIn));
  const [clockOutValue, setClockOutValue] = useState(
    clockOut ? toDatetimeLocal(clockOut) : ""
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Reason for edit is required");
      return;
    }
    setLoading(true);
    setError(null);

    const body: Record<string, string> = { reason: reason.trim() };
    if (clockInValue) body.clockIn = fromDatetimeLocal(clockInValue);
    if (clockOutValue) body.clockOut = fromDatetimeLocal(clockOutValue);

    const res = await fetch(`/api/admin/time-entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(json.message ?? json.error ?? "Failed to update entry");
      return;
    }

    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Time Entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clock-in">Clock In</Label>
            <Input
              id="clock-in"
              type="datetime-local"
              value={clockInValue}
              onChange={(e) => setClockInValue(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clock-out">Clock Out</Label>
            <Input
              id="clock-out"
              type="datetime-local"
              value={clockOutValue}
              onChange={(e) => setClockOutValue(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for edit</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Required"
              rows={3}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
