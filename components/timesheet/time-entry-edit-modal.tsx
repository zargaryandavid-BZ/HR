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
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Coffee, Utensils } from "lucide-react";

type BreakRow = {
  /** undefined = new (not yet saved) */
  id?: string;
  breakType: "REST" | "MEAL";
  startedAt: string;
  endedAt: string;
  /** true = mark for deletion on save */
  _delete?: boolean;
};

type ExistingBreak = {
  id: string;
  breakType: string;
  startedAt: string;
  endedAt: string | null;
  durationMin: number | null;
};

type Props = {
  entryId: string;
  clockIn: string;
  clockOut: string | null;
  breaks: ExistingBreak[];
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

function initBreaks(existing: ExistingBreak[]): BreakRow[] {
  return existing.map((b) => ({
    id: b.id,
    breakType: (b.breakType === "MEAL" ? "MEAL" : "REST") as "REST" | "MEAL",
    startedAt: toDatetimeLocal(b.startedAt),
    endedAt: b.endedAt ? toDatetimeLocal(b.endedAt) : "",
  }));
}

export function TimeEntryEditModal({
  entryId,
  clockIn,
  clockOut,
  breaks,
  open,
  onClose,
  onSaved,
}: Props) {
  const [clockInValue, setClockInValue] = useState(toDatetimeLocal(clockIn));
  const [clockOutValue, setClockOutValue] = useState(
    clockOut ? toDatetimeLocal(clockOut) : ""
  );
  const [reason, setReason] = useState("");
  const [breakRows, setBreakRows] = useState<BreakRow[]>(() => initBreaks(breaks));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function addBreak() {
    setBreakRows((rows) => [
      ...rows,
      {
        breakType: "REST",
        startedAt: clockInValue,
        endedAt: clockInValue,
      },
    ]);
  }

  function updateBreak(index: number, patch: Partial<BreakRow>) {
    setBreakRows((rows) =>
      rows.map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  }

  function removeBreak(index: number) {
    setBreakRows((rows) =>
      rows.map((r, i) =>
        i === index ? { ...r, _delete: true } : r
      )
    );
  }

  const visibleBreaks = breakRows.filter((r) => !r._delete);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Reason for edit is required");
      return;
    }

    for (const brk of visibleBreaks) {
      if (!brk.startedAt) {
        setError("All breaks must have a start time");
        return;
      }
    }

    setLoading(true);
    setError(null);

    const body: Record<string, unknown> = { reason: reason.trim() };
    if (clockInValue) body.clockIn = fromDatetimeLocal(clockInValue);
    if (clockOutValue) body.clockOut = fromDatetimeLocal(clockOutValue);

    body.breaks = breakRows.map((brk) => ({
      ...(brk.id ? { id: brk.id } : {}),
      breakType: brk.breakType,
      startedAt: fromDatetimeLocal(brk.startedAt),
      endedAt: brk.endedAt ? fromDatetimeLocal(brk.endedAt) : null,
      _delete: brk._delete ?? false,
    }));

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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Time Entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Clock In / Out */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="clock-in">Clock In</Label>
              <Input
                id="clock-in"
                type="datetime-local"
                value={clockInValue}
                onChange={(e) => setClockInValue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clock-out">Clock Out</Label>
              <Input
                id="clock-out"
                type="datetime-local"
                value={clockOutValue}
                onChange={(e) => setClockOutValue(e.target.value)}
              />
            </div>
          </div>

          {/* Breaks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Breaks</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={addBreak}
              >
                <Plus className="h-3 w-3" /> Add Break
              </Button>
            </div>

            {visibleBreaks.length === 0 && (
              <p className="text-xs text-muted-foreground py-1">
                No breaks recorded.
              </p>
            )}

            {breakRows.map((brk, i) => {
              if (brk._delete) return null;
              return (
                <div
                  key={i}
                  className="border rounded-md p-3 space-y-2 bg-slate-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateBreak(i, { breakType: "REST" })}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
                          brk.breakType === "REST"
                            ? "bg-amber-100 border-amber-400 text-amber-700"
                            : "border-slate-200 text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        <Coffee className="h-3 w-3" /> Rest
                      </button>
                      <button
                        type="button"
                        onClick={() => updateBreak(i, { breakType: "MEAL" })}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
                          brk.breakType === "MEAL"
                            ? "bg-amber-100 border-amber-400 text-amber-700"
                            : "border-slate-200 text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        <Utensils className="h-3 w-3" /> Meal
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {!brk.id && (
                        <Badge variant="secondary" className="text-xs h-5">New</Badge>
                      )}
                      <button
                        type="button"
                        onClick={() => removeBreak(i)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                        title="Remove break"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Start</Label>
                      <Input
                        type="datetime-local"
                        className="h-8 text-xs"
                        value={brk.startedAt}
                        onChange={(e) => updateBreak(i, { startedAt: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">End</Label>
                      <Input
                        type="datetime-local"
                        className="h-8 text-xs"
                        value={brk.endedAt}
                        onChange={(e) => updateBreak(i, { endedAt: e.target.value })}
                        placeholder="Leave blank if in progress"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason for edit</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Required"
              rows={2}
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
