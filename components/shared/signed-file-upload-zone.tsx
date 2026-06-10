"use client";

import { useCallback, useRef, useState } from "react";
import { Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/documents/storage";

type SignedFileUploadZoneProps = {
  label?: string;
  accept?: string;
  maxSizeMb?: number;
  disabled?: boolean;
  existingFile?: { fileName: string; fileUrl?: string } | null;
  onUpload: (file: File) => void | Promise<void>;
};

/** Drag-and-drop upload zone for signed document copies */
export function SignedFileUploadZone({
  label = "Upload your signed copy",
  accept = ".pdf,.jpg,.jpeg,.png",
  maxSizeMb = 10,
  disabled = false,
  existingFile,
  onUpload,
  uploading = false,
}: SignedFileUploadZoneProps & { uploading?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (file.size > maxSizeMb * 1024 * 1024) {
        setError(`File must be ${maxSizeMb}MB or less`);
        return;
      }
      await onUpload(file);
    },
    [maxSizeMb, onUpload]
  );

  if (existingFile) {
    return (
      <div className="rounded-lg border bg-green-50 border-green-200 p-4 space-y-2">
        <div className="flex items-center gap-2 text-green-800">
          <Check className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">{existingFile.fileName}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          Replace file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          disabled={disabled || uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled || uploading) return;
          const file = e.dataTransfer.files[0];
          if (file) void handleFile(file);
        }}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25",
          (disabled || uploading) && "opacity-50 cursor-not-allowed"
        )}
      >
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Drag and drop or click to browse
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, JPG, JPEG, PNG — max {maxSizeMb} MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          disabled={disabled || uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {uploading && (
        <p className="text-sm text-muted-foreground">Uploading...</p>
      )}
    </div>
  );
}

export { formatFileSize };
