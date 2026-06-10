"use client";

import { useEffect, useState } from "react";
import { WriteUpCategory } from "@prisma/client";
import { WRITEUP_CATEGORY_LABELS, type WriteUpItem } from "@/lib/individual-settings/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

type AddWriteUpSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  onSuccess: (message: string) => void;
  editWriteUp?: WriteUpItem | null;
};

const CATEGORIES = Object.keys(WRITEUP_CATEGORY_LABELS) as WriteUpCategory[];

/** Slide-over form to create a disciplinary write-up */
export function AddWriteUpSheet({
  open,
  onOpenChange,
  employeeId,
  onSuccess,
  editWriteUp,
}: AddWriteUpSheetProps) {
  const today = new Date().toISOString().split("T")[0];
  const isEdit = !!editWriteUp;
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState<WriteUpCategory>("ATTENDANCE");
  const [description, setDescription] = useState("");
  const [consequence, setConsequence] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editWriteUp && open) {
      setDate(new Date(editWriteUp.date).toISOString().split("T")[0]);
      setCategory(editWriteUp.category);
      setDescription(editWriteUp.description);
      setConsequence(editWriteUp.consequence ?? "");
      setFile(null);
      setError(null);
    }
  }, [editWriteUp, open]);

  function resetForm() {
    setDate(today);
    setCategory("ATTENDANCE");
    setDescription("");
    setConsequence("");
    setFile(null);
    setError(null);
  }

  async function handleSave() {
    if (!description.trim()) {
      setError("Description is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (isEdit && editWriteUp) {
        if (file) {
          const formData = new FormData();
          formData.append("description", description);
          formData.append("consequence", consequence.trim());
          formData.append("category", category);
          formData.append("date", date);
          formData.append("file", file);

          const res = await fetch(
            `/api/employees/${employeeId}/writeups/${editWriteUp.id}`,
            { method: "PATCH", body: formData }
          );
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Failed to update");
        } else {
          const res = await fetch(
            `/api/employees/${employeeId}/writeups/${editWriteUp.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                category,
                date,
                description,
                consequence: consequence.trim() || null,
              }),
            }
          );
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Failed to update");
        }
      } else {
        const formData = new FormData();
        formData.append("category", category);
        formData.append("date", date);
        formData.append("description", description);
        if (consequence.trim()) formData.append("consequence", consequence);
        if (file) formData.append("file", file);

        const res = await fetch(`/api/employees/${employeeId}/writeups`, {
          method: "POST",
          body: formData,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? json.message ?? "Failed to save");
      }

      resetForm();
      onOpenChange(false);
      onSuccess(isEdit ? "Write-up updated" : "Write-up saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <SheetContent className="flex flex-col max-w-xl px-6">
        <SheetHeader className="pb-2">
          <SheetTitle>{isEdit ? "Edit Write-up" : "Add Write-up"}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="writeup-date">Date</Label>
            <Input
              id="writeup-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as WriteUpCategory)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {WRITEUP_CATEGORY_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="writeup-description">Description</Label>
            <Textarea
              id="writeup-description"
              rows={5}
              placeholder="Describe the incident or behavior in detail"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="writeup-consequence">Consequence (optional)</Label>
            <Textarea
              id="writeup-consequence"
              rows={3}
              placeholder="Describe the action taken (e.g. verbal warning, one-day suspension)"
              value={consequence}
              onChange={(e) => setConsequence(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="writeup-file">Attach supporting document (optional)</Label>
            <Input
              id="writeup-file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">PDF, JPG, or PNG — max 10MB</p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <SheetFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : "Save Write-up"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
