"use client";

import { useState } from "react";
import { format } from "date-fns";
import { formatDisplayDate } from "@/lib/dates";
import type { FileUploadStepConfig } from "@/lib/onboarding/types";
import {
  formatAcceptedTypes,
  getUploadInstructions,
  type OnboardingTaskStep,
} from "@/lib/onboarding/task-types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SignedFileUploadZone } from "@/components/shared/signed-file-upload-zone";

type OnboardingUploadModalProps = {
  step: OnboardingTaskStep | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File, replace: boolean) => Promise<void>;
  uploading?: boolean;
};

/** Modal for uploading a FILE_UPLOAD onboarding step */
export function OnboardingUploadModal({
  step,
  open,
  onOpenChange,
  onUpload,
  uploading = false,
}: OnboardingUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [replacing, setReplacing] = useState(false);
  const config = (step?.config ?? {}) as FileUploadStepConfig & { instructions?: string };
  const instructions = getUploadInstructions(config);
  const acceptedLabel = formatAcceptedTypes(config.acceptedTypes ?? []);
  const maxSizeMb = config.maxSizeMb ?? 10;
  const isCompleted = step?.status === "COMPLETED";
  const fileName = (step?.responseData?.fileName as string | undefined) ?? null;

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setSelectedFile(null);
      setReplacing(false);
    }
    onOpenChange(nextOpen);
  }

  async function handleUpload(replace: boolean) {
    if (!selectedFile) return;
    await onUpload(selectedFile, replace);
    setSelectedFile(null);
    setReplacing(false);
    onOpenChange(false);
  }

  if (!step) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{step.title}</DialogTitle>
          <DialogDescription>
            {instructions || "Upload the requested file to complete this task."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 text-sm text-muted-foreground">
          {acceptedLabel && <p>Accepted: {acceptedLabel}</p>}
          <p>Max size: {maxSizeMb} MB</p>
        </div>

        {isCompleted && fileName && !replacing && (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            {fileName}
            {step.completedAt && (
              <span className="text-muted-foreground">
                {" "}
                — uploaded {formatDisplayDate(step.completedAt)}
              </span>
            )}
            <div className="mt-2">
              <Button variant="link" className="h-auto p-0 text-sm" onClick={() => setReplacing(true)}>
                Replace file
              </Button>
            </div>
          </div>
        )}

        {(!isCompleted || replacing) && (
          <>
            <SignedFileUploadZone
              label="Click to browse or drag file here"
              accept={config.acceptedTypes?.join(",") ?? ".pdf,.jpg,.jpeg,.png"}
              maxSizeMb={maxSizeMb}
              disabled={uploading}
              uploading={uploading}
              existingFile={null}
              onUpload={async (file) => setSelectedFile(file)}
            />

            {selectedFile && (
              <p className="text-sm">
                Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
              </p>
            )}

            <DialogFooter>
              <Button
                disabled={!selectedFile || uploading}
                onClick={() => void handleUpload(isCompleted && replacing)}
              >
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
