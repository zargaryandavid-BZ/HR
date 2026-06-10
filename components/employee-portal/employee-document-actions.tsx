"use client";

import { useRef } from "react";
import { Download, ExternalLink, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DocumentCompletionStatus } from "@/lib/individual-settings/constants";
import { employeeNeedsSignedUpload } from "@/lib/individual-settings/constants";

type EmployeeDocumentActionsProps = {
  fileUrl: string;
  signedFileUrl: string | null;
  status: DocumentCompletionStatus;
  uploading: boolean;
  onUpload: (file: File) => void;
};

/** Download / upload / view actions for an employee onboarding document row */
export function EmployeeDocumentActions({
  fileUrl,
  signedFileUrl,
  status,
  uploading,
  onUpload,
}: EmployeeDocumentActionsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isCompleted = status === "signed" || status === "hr_approved";
  const needsSignedUpload = employeeNeedsSignedUpload(status);

  if (isCompleted && signedFileUrl) {
    return (
      <div className="flex flex-col gap-1 w-[118px] shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-7 w-full justify-center text-green-700 border-green-200 hover:bg-green-50"
          asChild
        >
          <a href={signedFileUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3 w-3 mr-1" />
            View signed
          </a>
        </Button>
      </div>
    );
  }

  if (!needsSignedUpload) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1 w-[118px] shrink-0">
      <Button size="sm" variant="outline" className="text-xs h-7 w-full justify-center px-2" asChild>
        <a href={fileUrl} download target="_blank" rel="noopener noreferrer">
          <Download className="h-3 w-3 mr-1" />
          Download
        </a>
      </Button>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />

      <Button
        size="sm"
        variant="default"
        className="text-xs h-7 w-full justify-center px-2"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-3 w-3 mr-1" />
        {uploading ? "Uploading…" : "Upload signed"}
      </Button>
    </div>
  );
}
