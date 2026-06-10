"use client";

import { useEffect, useMemo, useState } from "react";
import type { IdDocType } from "@prisma/client";
import { format, parseISO, startOfDay } from "date-fns";
import { Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SignedFileUploadZone } from "@/components/shared/signed-file-upload-zone";
import {
  ID_DOC_FIELD_CONFIG,
  ID_DOC_TYPE_LABELS,
  ID_DOC_TYPES,
} from "@/lib/identity-documents/constants";
import { formatSsnDisplay, isValidSsn, stripSsnDigits } from "@/lib/identity-documents/ssn";
import type { IdentityDocumentDto } from "@/lib/identity-documents/service";

type IdentityDocumentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  document?: IdentityDocumentDto | null;
  onSuccess: (message: string) => void;
};

/** Modal form to add or edit an employee identity document */
export function IdentityDocumentModal({
  open,
  onOpenChange,
  employeeId,
  document,
  onSuccess,
}: IdentityDocumentModalProps) {
  const isEdit = !!document;
  const [docType, setDocType] = useState<IdDocType>("SSN");
  const [documentNumber, setDocumentNumber] = useState("");
  const [country, setCountry] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [replaceFile, setReplaceFile] = useState(false);
  const [showNumber, setShowNumber] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldConfig = ID_DOC_FIELD_CONFIG[docType];

  useEffect(() => {
    if (!open) return;
    if (document) {
      setDocType(document.docType);
      setDocumentNumber("");
      setCountry(document.country ?? "");
      setExpiryDate(
        document.expiryDate
          ? format(parseISO(document.expiryDate), "yyyy-MM-dd")
          : ""
      );
      setNotes(document.notes ?? "");
      setFile(null);
      setReplaceFile(false);
    } else {
      setDocType("SSN");
      setDocumentNumber("");
      setCountry("");
      setExpiryDate("");
      setNotes("");
      setFile(null);
      setReplaceFile(false);
    }
    setShowNumber(false);
    setError(null);
  }, [open, document]);

  function handleDocumentNumberChange(raw: string) {
    if (fieldConfig.numbersOnly) {
      setDocumentNumber(formatSsnDisplay(stripSsnDigits(raw)));
      return;
    }
    setDocumentNumber(raw);
  }

  const expiryIsPast = useMemo(() => {
    if (!expiryDate || !fieldConfig.showExpiry) return false;
    return startOfDay(parseISO(expiryDate)) < startOfDay(new Date());
  }, [expiryDate, fieldConfig.showExpiry]);

  const canSave = useMemo(() => {
    const hasNumber = documentNumber.trim().length > 0;
    const ssnValid = docType !== "SSN" || !hasNumber || isValidSsn(documentNumber);
    const hasOtherFields =
      country.trim() ||
      expiryDate ||
      notes.trim() ||
      file ||
      (isEdit && document?.fileUrl);

    if (!ssnValid) return false;

    if (!isEdit && docType === "SSN") {
      return isValidSsn(documentNumber) && !!file;
    }

    if (isEdit) {
      return hasNumber || hasOtherFields;
    }

    return (
      docType &&
      (hasNumber || country.trim() || expiryDate || notes.trim() || file)
    );
  }, [isEdit, docType, documentNumber, country, expiryDate, notes, file, document?.fileUrl]);

  const saveHint = useMemo(() => {
    if (canSave || isEdit) return null;
    if (docType === "SSN" && !isEdit) {
      if (!isValidSsn(documentNumber)) {
        return "Enter a complete 9-digit SSN (XXX-XX-XXXX)";
      }
      if (!file) {
        return "Attach a file (e.g. Social Security card scan) to save";
      }
    }
    return "Fill in at least one field to save";
  }, [canSave, isEdit, docType, documentNumber, file]);

  async function handleSave() {
    if (!canSave) return;

    setSaving(true);
    setError(null);

    try {
      const formData = new FormData();
      if (!isEdit) formData.append("docType", docType);
      if (documentNumber.trim()) formData.append("documentNumber", documentNumber.trim());
      if (fieldConfig.showCountry && country.trim()) {
        formData.append("country", country.trim());
      }
      if (fieldConfig.showExpiry) {
        formData.append("expiryDate", expiryDate);
      }
      if (notes.trim()) formData.append("notes", notes.trim());
      if (file) formData.append("file", file);

      const url = isEdit
        ? `/api/employees/${employeeId}/identity-documents/${document!.id}`
        : `/api/employees/${employeeId}/identity-documents`;
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, { method, body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Failed to save");

      onSuccess(isEdit ? "Identity document updated" : "Identity document added");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest("[data-radix-select-content]")) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest("[data-radix-select-content]")) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit identity document" : "Add identity document"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Document type</Label>
            {isEdit ? (
              <Input value={ID_DOC_TYPE_LABELS[docType]} disabled />
            ) : (
              <Select value={docType} onValueChange={(v) => setDocType(v as IdDocType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  {ID_DOC_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {ID_DOC_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>{fieldConfig.numberLabel}</Label>
            <div className="relative">
              <Input
                value={documentNumber}
                onChange={(e) => handleDocumentNumberChange(e.target.value)}
                placeholder={fieldConfig.numberPlaceholder}
                type={fieldConfig.maskInput && !showNumber ? "password" : "text"}
                inputMode={fieldConfig.numbersOnly ? "numeric" : "text"}
                autoComplete="off"
                className={fieldConfig.maskInput ? "pr-10" : undefined}
              />
              {fieldConfig.maskInput && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowNumber((v) => !v)}
                  aria-label={showNumber ? "Hide number" : "Show number"}
                >
                  {showNumber ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              )}
            </div>
            {fieldConfig.numbersOnly && (
              <p className="text-xs text-muted-foreground">
                Numbers only — formatted as XXX-XX-XXXX
              </p>
            )}
            {isEdit && document?.documentNumber && (
              <p className="text-xs text-muted-foreground">
                A number is on file (hidden). Leave blank to keep unchanged.
              </p>
            )}
          </div>

          {fieldConfig.showCountry && (
            <div className="space-y-2">
              <Label>{fieldConfig.countryLabel}</Label>
              <Input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder={fieldConfig.countryPlaceholder}
              />
            </div>
          )}

          {fieldConfig.showExpiry && (
            <div className="space-y-2">
              <Label>Expiry date</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
              {expiryIsPast && (
                <p className="text-sm text-destructive">This document has expired.</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional context HR needs to record"
            />
          </div>

          <div className="space-y-2">
            <Label>
              File attachment
              {fieldConfig.requireAttachmentOnCreate && !isEdit && (
                <span className="text-destructive ml-1">*</span>
              )}
            </Label>
            {isEdit && document?.fileName && !replaceFile && !file ? (
              <SignedFileUploadZone
                label=""
                accept=".pdf,.jpg,.jpeg,.png,.heic,.heif"
                maxSizeMb={20}
                existingFile={{ fileName: document.fileName, fileUrl: document.fileUrl ?? undefined }}
                onUpload={(f) => {
                  setFile(f);
                  setReplaceFile(true);
                }}
              />
            ) : (
              <SignedFileUploadZone
                label="Click to browse or drag file here"
                accept=".pdf,.jpg,.jpeg,.png,.heic,.heif"
                maxSizeMb={20}
                onUpload={(f) => setFile(f)}
              />
            )}
            {file && (
              <p className="text-xs text-muted-foreground">
                Selected: {file.name}
              </p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error && saveHint && (
            <p className="text-sm text-muted-foreground">{saveHint}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
