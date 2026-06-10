"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import type { DocumentType } from "@prisma/client";
import type { DocumentListItem, DocumentScope } from "@/lib/documents/constants";
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES,
  DOCUMENT_SCOPE_LABELS,
} from "@/lib/documents/constants";
import { formatFileSize } from "@/lib/documents/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ErrorMessage } from "@/components/shared/page-header";

type DocumentFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document?: DocumentListItem | null;
  onSaved: (result: {
    document: DocumentListItem;
    versionIncremented: boolean;
    assignedCount: number;
    notificationsSent?: boolean;
  }) => void;
  onDeleted?: () => void;
};

/** Slide-over panel for creating or editing a repository document */
export function DocumentFormModal({
  open,
  onOpenChange,
  document,
  onSaved,
  onDeleted,
}: DocumentFormModalProps) {
  const isEdit = !!document;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [documentType, setDocumentType] = useState<DocumentType>("SOP");
  const [scope, setScope] = useState<DocumentScope>("POSITION_SPECIFIC");
  const [isActive, setIsActive] = useState(true);
  const [fileUrl, setFileUrl] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [newFileSelected, setNewFileSelected] = useState(false);
  const [notifyOnVersionUpdate, setNotifyOnVersionUpdate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(document?.title ?? "");
    setDescription(document?.description ?? "");
    setDocumentType(document?.documentType ?? "SOP");
    setScope(document?.scope ?? "POSITION_SPECIFIC");
    setIsActive(document?.isActive ?? true);
    setFileUrl(document?.fileUrl ?? "");
    setFileName(document?.fileName ?? null);
    setFileSize(null);
    setNewFileSelected(false);
    setNotifyOnVersionUpdate(false);
    setError(null);
  }, [open, document]);

  const nextVersion = isEdit && newFileSelected ? (document?.version ?? 0) + 1 : document?.version ?? 1;

  /** Upload a PDF file to storage */
  async function handleFileUpload(file: File) {
    if (file.type !== "application/pdf") {
      setError("Only PDF files are accepted");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("File must be 20 MB or smaller");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setFileUrl(json.data.fileUrl);
      setFileName(json.data.fileName);
      setFileSize(json.data.fileSize);
      setNewFileSelected(true);
      setNotifyOnVersionUpdate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  /** Save document to the repository */
  async function handleSave() {
    if (!title.trim() || !description.trim() || !fileUrl) {
      setError("Title, description, and PDF file are required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        title,
        description,
        documentType,
        fileUrl,
        isActive,
        scope,
        departmentIds: [] as string[],
        positionIds: [] as string[],
      };
      const url = isEdit ? `/api/documents/${document!.id}` : "/api/documents";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");

      const versionIncremented = !!json.data.versionIncremented;
      const assignedCount = json.data.assignedCount ?? document?.assignedCount ?? 0;
      let notificationsSent = false;

      if (
        notifyOnVersionUpdate &&
        versionIncremented &&
        assignedCount > 0 &&
        isEdit
      ) {
        const notifyRes = await fetch(`/api/documents/${document!.id}/notify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: json.data.version }),
        });
        notificationsSent = notifyRes.ok;
      }

      onSaved({
        document: json.data,
        versionIncremented,
        assignedCount,
        notificationsSent,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  /** Archive (soft-delete) the document */
  async function handleDelete() {
    if (!document) return;

    const confirmed = window.confirm(
      `Delete "${document.title}"? This document will be archived and removed from the repository. Assigned employees will no longer see it.`
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${document.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? "Failed to delete document");
      }

      onDeleted?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete document");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col p-0 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Document" : "Add Document"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update document details, scope, or upload a new file version."
              : "Add a document to the repository and set who it applies to."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {error && <ErrorMessage message={error} />}

          <div className="space-y-4">
            <h3 className="font-semibold">Document Details</h3>
            <div className="space-y-2">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Document Type <span className="text-destructive">*</span></Label>
              <Select value={documentType} onValueChange={(v) => setDocumentType(v as DocumentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {DOCUMENT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label>Scope <span className="text-destructive">*</span></Label>
              {(Object.keys(DOCUMENT_SCOPE_LABELS) as DocumentScope[]).map((key) => (
                <label
                  key={key}
                  className="flex items-start gap-3 rounded-md border p-3 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
                    type="radio"
                    name="document-scope"
                    value={key}
                    checked={scope === key}
                    onChange={() => setScope(key)}
                    className="mt-1"
                  />
                  <span className="text-sm">{DOCUMENT_SCOPE_LABELS[key]}</span>
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Description <span className="text-destructive">*</span></Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this document covers and why employees need it"
                rows={4}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Active</Label>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">File Upload</h3>
            {isEdit && newFileSelected && (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900 space-y-3">
                <p>
                  Uploading a new file will create version {nextVersion} of this document.
                </p>
                {(document?.assignedCount ?? 0) > 0 && (
                  <label className="flex items-start gap-2 cursor-pointer">
                    <Checkbox
                      checked={notifyOnVersionUpdate}
                      onCheckedChange={(checked) =>
                        setNotifyOnVersionUpdate(checked === true)
                      }
                      className="mt-0.5"
                    />
                    <span>
                      Notify {document!.assignedCount} assigned employee
                      {document!.assignedCount === 1 ? "" : "s"} about this update
                    </span>
                  </label>
                )}
              </div>
            )}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) void handleFileUpload(file);
              }}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-3">
                Drag and drop a PDF here, or click to browse
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? "Uploading..." : "Upload PDF"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file);
                }}
              />
              <p className="text-xs text-muted-foreground mt-2">PDF only, max 20 MB</p>
            </div>
            {fileUrl && (
              <div className="text-sm space-y-1">
                <p><span className="font-medium">File:</span> {fileName ?? "document.pdf"}</p>
                {fileSize && <p><span className="font-medium">Size:</span> {formatFileSize(fileSize)}</p>}
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Preview
                </a>
              </div>
            )}
          </div>
        </div>

        <SheetFooter className="shrink-0 flex-row justify-between sm:justify-between border-t bg-background">
          {isEdit && document?.status !== "ARCHIVED" ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={deleting || saving || uploading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleting ? "Deleting..." : "Delete Document"}
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving || uploading || deleting}>
              {saving ? "Saving..." : "Save Document"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
