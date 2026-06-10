"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { T_SHIRT_SIZE_LABELS, T_SHIRT_SIZES } from "@/lib/employees/personal-info-constants";
import type { TShirtSize } from "@prisma/client";

type PreferencesData = {
  tshirtSize?: TShirtSize | null;
  allergyInfo?: string | null;
};

/** A single labeled info row for read state */
function PrefRow({ label, value }: { label: string; value?: string | null }) {
  const isEmpty = !value;
  return (
    <div className="flex justify-between gap-2 items-start text-[11px]">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span
        className={cn(
          "font-semibold leading-snug break-words min-w-0 text-right",
          isEmpty && "text-muted-foreground font-normal"
        )}
      >
        {value || "—"}
      </span>
    </div>
  );
}

/** Editable preferences sub-section — t-shirt size and allergy info */
export function EmployeePreferencesSection({ data }: { data: PreferencesData }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tshirtSize, setTshirtSize] = useState<string>(data.tshirtSize ?? "");
  const [allergyInfo, setAllergyInfo] = useState(data.allergyInfo ?? "");

  function openEdit() {
    setTshirtSize(data.tshirtSize ?? "");
    setAllergyInfo(data.allergyInfo ?? "");
    setError(null);
    setEditing(true);
  }

  function handleCancel() {
    setEditing(false);
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/employee/me/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tshirtSize: tshirtSize || null,
          allergyInfo: allergyInfo.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to save");

      await queryClient.invalidateQueries({ queryKey: ["employee-me"] });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mt-3.5 mb-2 border-b pb-1 flex items-center justify-between">
        <p
          className="text-[10px] font-medium uppercase tracking-[0.5px] text-muted-foreground"
          style={{ letterSpacing: "0.5px" }}
        >
          Preferences
        </p>
        {!editing && (
          <button
            type="button"
            onClick={openEdit}
            className="text-muted-foreground hover:text-primary transition-colors"
            title="Edit preferences"
            aria-label="Edit preferences"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">T-shirt size</label>
            <Select
              value={tshirtSize || undefined}
              onValueChange={setTshirtSize}
            >
              <SelectTrigger className="h-8 text-[11px]">
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                {T_SHIRT_SIZES.map((size) => (
                  <SelectItem key={size} value={size} className="text-[11px]">
                    {T_SHIRT_SIZE_LABELS[size]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Allergy information</label>
            <Textarea
              rows={3}
              value={allergyInfo}
              onChange={(e) => setAllergyInfo(e.target.value)}
              placeholder="e.g. peanuts, dairy, shellfish…"
              className="text-[11px] resize-none"
              maxLength={500}
            />
          </div>

          {error && <p className="text-[11px] text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 text-xs flex-1"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs flex-1"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <PrefRow
            label="T-shirt size"
            value={data.tshirtSize ? T_SHIRT_SIZE_LABELS[data.tshirtSize] : null}
          />
          <PrefRow label="Allergies" value={data.allergyInfo} />
        </div>
      )}
    </>
  );
}
