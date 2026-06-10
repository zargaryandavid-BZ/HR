"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { Download } from "lucide-react";
import type {
  FormFieldConfig,
  FormStepConfig,
  DocumentSignStepConfig,
  SurveyStepConfig,
  SurveyQuestionConfig,
  FileUploadStepConfig,
} from "@/lib/onboarding/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentTypeBadge } from "@/components/documents/document-type-badge";
import { SignedFileUploadZone } from "@/components/shared/signed-file-upload-zone";
import type { DocumentType } from "@prisma/client";

type WizardStep = {
  id: string;
  title: string;
  description: string | null;
  stepType: "FORM" | "DOCUMENT_SIGN" | "SURVEY" | "FILE_UPLOAD";
  isRequired: boolean;
  config: Record<string, unknown>;
  progress: {
    id: string;
    status: "LOCKED" | "AVAILABLE" | "IN_PROGRESS" | "COMPLETED";
    responseData: Record<string, unknown> | null;
  };
};

type StepRendererProps = {
  step: WizardStep;
  instanceId?: string;
  previewMode?: boolean;
  onPreviewAction?: () => void;
  onComplete?: () => void;
};

/** Render the active onboarding step based on its type */
export function OnboardingStepRenderer({
  step,
  instanceId,
  previewMode = false,
  onPreviewAction,
  onComplete,
}: StepRendererProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePreviewAction() {
    onPreviewAction?.();
  }

  if (step.progress.status === "LOCKED") {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Complete the previous step to unlock this one.
        </CardContent>
      </Card>
    );
  }

  if (step.progress.status === "COMPLETED") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{step.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-green-700 text-sm">✓ Step completed</p>
        </CardContent>
      </Card>
    );
  }

  async function markInProgress() {
    if (previewMode || !instanceId) return;
    await fetch(`/api/onboarding/instances/${instanceId}/steps/${step.id}`, {
      method: "POST",
    });
  }

  async function submitResponse(responseData: Record<string, unknown>) {
    if (previewMode) {
      handlePreviewAction();
      onComplete?.();
      return;
    }
    if (!instanceId) return;

    setSubmitting(true);
    setError(null);
    try {
      await markInProgress();
      const res = await fetch(`/api/onboarding/instances/${instanceId}/steps/${step.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseData }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error);
      onComplete?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadFile(file: File) {
    if (previewMode) {
      handlePreviewAction();
      onComplete?.();
      return;
    }
    if (!instanceId) return;

    setSubmitting(true);
    setError(null);
    try {
      await markInProgress();
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(
        `/api/onboarding/instances/${instanceId}/steps/${step.id}/upload`,
        { method: "POST", body: formData }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error);
      onComplete?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <StepShell step={step} previewMode={previewMode}>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {step.stepType === "FORM" && (
          <FormStepContent
            config={step.config as FormStepConfig}
            onSubmit={(data) => void submitResponse({ answers: data })}
            submitting={submitting}
          />
        )}

        {step.stepType === "DOCUMENT_SIGN" && (
          <DocumentStepContent
            config={step.config as DocumentSignStepConfig}
            instanceId={instanceId}
            stepId={step.id}
            previewMode={previewMode}
            responseData={step.progress.responseData}
            onPreviewAction={handlePreviewAction}
            onComplete={onComplete}
          />
        )}

        {step.stepType === "SURVEY" && (
          <SurveyStepContent
            config={step.config as SurveyStepConfig}
            onSubmit={(data) => void submitResponse({ answers: data })}
            submitting={submitting}
          />
        )}

        {step.stepType === "FILE_UPLOAD" && (
          <FileUploadStepContent
            config={step.config as FileUploadStepConfig}
            previewMode={previewMode}
            responseData={step.progress.responseData}
            onPreviewAction={handlePreviewAction}
            onUpload={(file) => void uploadFile(file)}
            submitting={submitting}
            onComplete={onComplete}
          />
        )}
    </StepShell>
  );
}

function StepShell({
  step,
  previewMode,
  children,
}: {
  step: WizardStep;
  previewMode: boolean;
  children: React.ReactNode;
}) {
  if (previewMode) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold">{step.title}</h3>
          {step.description && (
            <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
              {step.description}
            </p>
          )}
        </div>
        {children}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{step.title}</CardTitle>
        {step.description && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{step.description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function FormStepContent({
  config,
  onSubmit,
  submitting,
}: {
  config: FormStepConfig;
  onSubmit: (data: Record<string, string | boolean>) => void;
  submitting: boolean;
}) {
  const { register, handleSubmit, control, formState: { errors } } = useForm();

  return (
    <form
      onSubmit={handleSubmit((data) => onSubmit(data as Record<string, string | boolean>))}
      className="space-y-4"
    >
      {(config.fields ?? []).map((field: FormFieldConfig) => (
        <div key={field.id} className="space-y-2">
          <Label>
            {field.label}
            {field.required && <span className="text-destructive"> *</span>}
          </Label>
          {field.type === "dropdown" ? (
            <Controller
              name={field.id}
              control={control}
              rules={{ required: field.required }}
              render={({ field: f }) => (
                <Select value={f.value} onValueChange={f.onChange}>
                  <SelectTrigger><SelectValue placeholder={field.placeholder} /></SelectTrigger>
                  <SelectContent>
                    {field.options?.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          ) : field.type === "checkbox" ? (
            <Controller
              name={field.id}
              control={control}
              render={({ field: f }) => (
                <Checkbox checked={!!f.value} onCheckedChange={f.onChange} />
              )}
            />
          ) : field.type === "yes_no" ? (
            <Controller
              name={field.id}
              control={control}
              rules={{ required: field.required }}
              render={({ field: f }) => (
                <Select value={f.value} onValueChange={f.onChange}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          ) : (
            <Input
              type={
                field.type === "number"
                  ? "number"
                  : field.type === "date"
                    ? "date"
                    : field.type === "email"
                      ? "email"
                      : "text"
              }
              placeholder={field.placeholder}
              {...register(field.id, { required: field.required })}
            />
          )}
          {errors[field.id] && (
            <p className="text-sm text-destructive">This field is required</p>
          )}
        </div>
      ))}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Submitting..." : "Submit"}
      </Button>
    </form>
  );
}

function DocumentStepContent({
  config,
  instanceId,
  stepId,
  previewMode,
  responseData,
  onPreviewAction,
  onComplete,
}: {
  config: DocumentSignStepConfig;
  instanceId?: string;
  stepId: string;
  previewMode: boolean;
  responseData: Record<string, unknown> | null;
  onPreviewAction?: () => void;
  onComplete?: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: resolvedDoc } = useQuery({
    queryKey: ["onboarding-document", config.documentId],
    queryFn: async () => {
      if (!config.documentId) return null;
      const res = await fetch(`/api/employee/documents/${config.documentId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data as {
        title: string;
        description: string;
        documentType: DocumentType;
        version: number;
        fileUrl: string;
      };
    },
    enabled: !!config.documentId,
  });

  const title = resolvedDoc?.title ?? config.documentName ?? "Document";
  const fileUrl = resolvedDoc?.fileUrl ?? config.fileUrl;
  const description = resolvedDoc?.description;

  const existingFile = responseData?.fileName
    ? {
        fileName: String(responseData.fileName),
        fileUrl: responseData.signedFileUrl
          ? String(responseData.signedFileUrl)
          : undefined,
      }
    : null;

  async function handleUpload(file: File) {
    if (previewMode) {
      onPreviewAction?.();
      onComplete?.();
      return;
    }
    if (!instanceId) return;

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(
        `/api/onboarding/instances/${instanceId}/steps/${stepId}/document-sign`,
        { method: "POST", body: formData }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error);
      onComplete?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium">{title}</p>
          {resolvedDoc && (
            <>
              <DocumentTypeBadge type={resolvedDoc.documentType} />
              <span className="text-xs text-muted-foreground">v{resolvedDoc.version}</span>
            </>
          )}
        </div>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>

      {fileUrl && (
        <Button variant="default" asChild>
          <a href={fileUrl} download target="_blank" rel="noopener noreferrer">
            <Download className="h-4 w-4 mr-2" />
            Download Document
          </a>
        </Button>
      )}

      <SignedFileUploadZone
        existingFile={existingFile}
        disabled={uploading}
        uploading={uploading}
        onUpload={handleUpload}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <p className="text-sm text-muted-foreground">
        {config.acknowledgmentText ??
          "Upload your signed copy above to complete this step."}
      </p>
    </div>
  );
}

function SurveyStepContent({
  config,
  onSubmit,
  submitting,
}: {
  config: SurveyStepConfig;
  onSubmit: (data: Record<string, string>) => void;
  submitting: boolean;
}) {
  const { register, handleSubmit, control, formState: { errors } } = useForm();

  return (
    <form
      onSubmit={handleSubmit((data) => onSubmit(data as Record<string, string>))}
      className="space-y-4"
    >
      {(config.questions ?? []).map((q: SurveyQuestionConfig) => (
        <div key={q.id} className="space-y-2">
          <Label>
            {q.question}
            {q.required && <span className="text-destructive"> *</span>}
          </Label>
          {q.answerType === "paragraph" ? (
            <Textarea {...register(q.id, { required: q.required })} />
          ) : q.answerType === "multiple_choice" ? (
            <Controller
              name={q.id}
              control={control}
              rules={{ required: q.required }}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {q.options?.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          ) : q.answerType === "yes_no" ? (
            <Controller
              name={q.id}
              control={control}
              rules={{ required: q.required }}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          ) : q.answerType === "rating" ? (
            <Controller
              name={q.id}
              control={control}
              rules={{ required: q.required }}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Rate 1–5" /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          ) : (
            <Input {...register(q.id, { required: q.required })} />
          )}
          {errors[q.id] && (
            <p className="text-sm text-destructive">This question is required</p>
          )}
        </div>
      ))}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Submitting..." : "Submit Answers"}
      </Button>
    </form>
  );
}

function FileUploadStepContent({
  config,
  previewMode,
  responseData,
  onPreviewAction,
  onUpload,
  submitting,
  onComplete,
}: {
  config: FileUploadStepConfig;
  previewMode: boolean;
  responseData: Record<string, unknown> | null;
  onPreviewAction?: () => void;
  onUpload: (file: File) => void;
  submitting: boolean;
  onComplete?: () => void;
}) {
  const { data: referenceDoc } = useQuery({
    queryKey: ["onboarding-reference-doc", config.referenceDocumentId],
    queryFn: async () => {
      if (!config.referenceDocumentId) return null;
      const res = await fetch(`/api/employee/documents/${config.referenceDocumentId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data as { title: string; fileUrl: string };
    },
    enabled: !!config.referenceDocumentId,
  });

  const existingFile = responseData?.fileName
    ? { fileName: String(responseData.fileName) }
    : null;

  return (
    <div className="space-y-4">
      <p className="text-sm whitespace-pre-wrap">{config.instruction}</p>

      {referenceDoc && (
        <Button variant="default" asChild>
          <a
            href={referenceDoc.fileUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Reference Document
          </a>
        </Button>
      )}

      {existingFile ? (
        <SignedFileUploadZone
          existingFile={existingFile}
          accept={config.acceptedTypes?.join(",") ?? ".pdf,.jpg,.jpeg,.png"}
          maxSizeMb={config.maxSizeMb ?? 10}
          disabled={submitting}
          uploading={submitting}
          label="Upload your file"
          onUpload={(file) => {
            if (previewMode) {
              onPreviewAction?.();
              onComplete?.();
              return;
            }
            onUpload(file);
          }}
        />
      ) : (
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <Input
            type="file"
            accept={config.acceptedTypes?.join(",")}
            disabled={submitting}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (previewMode) {
                  onPreviewAction?.();
                  onComplete?.();
                } else {
                  onUpload(file);
                }
              }
            }}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Max size: {config.maxSizeMb ?? 10}MB
          </p>
        </div>
      )}
    </div>
  );
}
