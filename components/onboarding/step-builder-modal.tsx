"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FlowStep } from "@/components/onboarding/sortable-step-list";
import type {
  FormFieldConfig,
  FormFieldType,
  SurveyQuestionConfig,
  SurveyAnswerType,
} from "@/lib/onboarding/types";
import { DocumentTypeBadge } from "@/components/documents/document-type-badge";
import type { DocumentListItem } from "@/lib/documents/constants";

type StepBuilderModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: FlowStep | null;
  positionId: string;
  onSave: (data: {
    title: string;
    description?: string;
    stepType: FlowStep["stepType"];
    isRequired: boolean;
    config: Record<string, unknown>;
  }) => void;
  isSaving: boolean;
};

function newFieldId() {
  return `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Parse comma-separated option text into a trimmed, non-empty array */
function parseCommaSeparatedOptions(value: string): string[] {
  return value.split(",").map((o) => o.trim()).filter(Boolean);
}

/** Format stored options for display in the comma-separated input */
function formatOptionsForInput(options?: string[]): string {
  return options?.join(", ") ?? "";
}

/** Check whether a position-specific document applies to the flow's position */
function documentAppliesToPosition(
  doc: DocumentListItem,
  positionId: string,
  departmentId: string
): boolean {
  if (doc.scope !== "POSITION_SPECIFIC") return false;
  return (
    doc.positionIds.includes(positionId) ||
    doc.departmentIds.includes(departmentId) ||
    doc.assignmentTags.some(
      (tag) =>
        (tag.kind === "position" && tag.id === positionId) ||
        (tag.kind === "department" && tag.id === departmentId)
    )
  );
}

/** Format assigned document label with position/department tags */
function formatAssignedDocumentLabel(doc: DocumentListItem): string {
  const tags = doc.assignmentTags.map((tag) => tag.label).join(", ");
  const base = `${doc.title} (v${doc.version})`;
  return tags ? `${base} · ${tags}` : base;
}

/** Document picker groups for onboarding step configuration */
function DocumentPickerOptions({
  companyWideDocuments,
  assignedDocuments,
}: {
  companyWideDocuments: DocumentListItem[];
  assignedDocuments: DocumentListItem[];
}) {
  return (
    <>
      {companyWideDocuments.length > 0 && (
        <SelectGroup>
          <SelectLabel>Company-wide documents</SelectLabel>
          {companyWideDocuments.map((doc) => (
            <SelectItem key={doc.id} value={doc.id}>
              {doc.title} (v{doc.version})
            </SelectItem>
          ))}
        </SelectGroup>
      )}
      {assignedDocuments.length > 0 && (
        <SelectGroup>
          <SelectLabel>Assigned documents</SelectLabel>
          {assignedDocuments.map((doc) => (
            <SelectItem key={doc.id} value={doc.id}>
              {formatAssignedDocumentLabel(doc)}
            </SelectItem>
          ))}
        </SelectGroup>
      )}
    </>
  );
}

/** Modal for creating or editing an onboarding flow step */
export function StepBuilderModal({
  open,
  onOpenChange,
  step,
  positionId,
  onSave,
  isSaving,
}: StepBuilderModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stepType, setStepType] = useState<FlowStep["stepType"]>("FORM");
  const [isRequired, setIsRequired] = useState(true);
  const [fields, setFields] = useState<FormFieldConfig[]>([]);
  const [fieldOptionsRaw, setFieldOptionsRaw] = useState<Record<string, string>>({});
  const [questions, setQuestions] = useState<SurveyQuestionConfig[]>([]);
  const [questionOptionsRaw, setQuestionOptionsRaw] = useState<Record<string, string>>({});
  const [documentId, setDocumentId] = useState("");
  const [uploadInstruction, setUploadInstruction] = useState("");
  const [acceptedTypes, setAcceptedTypes] = useState(".pdf,.jpg,.jpeg,.png");
  const [maxSizeMb, setMaxSizeMb] = useState(10);
  const [referenceDocumentId, setReferenceDocumentId] = useState("");

  const { data: position } = useQuery({
    queryKey: ["position", positionId],
    queryFn: async () => {
      const res = await fetch(`/api/settings/positions/${positionId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data as { id: string; departmentId: string; name: string };
    },
    enabled: open && !!positionId,
  });

  const { data: repositoryDocuments } = useQuery({
    queryKey: ["documents-picker", positionId],
    queryFn: async () => {
      const res = await fetch("/api/documents?status=active");
      const json = await res.json();
      return json.data as DocumentListItem[];
    },
    enabled: open,
  });

  const companyWideDocuments =
    repositoryDocuments?.filter((d) => d.scope === "COMPANY_WIDE") ?? [];

  const assignedDocuments = useMemo(() => {
    const docs =
      repositoryDocuments?.filter((d) => d.scope === "POSITION_SPECIFIC") ?? [];

    if (!position) {
      return [...docs].sort((a, b) => a.title.localeCompare(b.title));
    }

    return [...docs].sort((a, b) => {
      const aRelevant = documentAppliesToPosition(a, position.id, position.departmentId)
        ? 0
        : 1;
      const bRelevant = documentAppliesToPosition(b, position.id, position.departmentId)
        ? 0
        : 1;
      return aRelevant - bRelevant || a.title.localeCompare(b.title);
    });
  }, [repositoryDocuments, position]);

  const pickerDocuments = [...companyWideDocuments, ...assignedDocuments];

  const selectedDocument = repositoryDocuments?.find((d) => d.id === documentId);

  useEffect(() => {
    if (!open) return;
    setTitle(step?.title ?? "");
    setDescription(step?.description ?? "");
    setStepType(step?.stepType ?? "FORM");
    setIsRequired(step?.isRequired ?? true);

    const config = step?.config ?? {};
    if (step?.stepType === "FORM" || !step) {
      const loadedFields = (config as { fields?: FormFieldConfig[] }).fields ?? [];
      setFields(loadedFields);
      const rawFieldOptions: Record<string, string> = {};
      for (const field of loadedFields) {
        if (field.type === "dropdown" && field.options?.length) {
          rawFieldOptions[field.id] = formatOptionsForInput(field.options);
        }
      }
      setFieldOptionsRaw(rawFieldOptions);
    }
    if (step?.stepType === "SURVEY") {
      const loadedQuestions = (config as { questions?: SurveyQuestionConfig[] }).questions ?? [];
      setQuestions(loadedQuestions);
      const rawQuestionOptions: Record<string, string> = {};
      for (const question of loadedQuestions) {
        if (question.answerType === "multiple_choice" && question.options?.length) {
          rawQuestionOptions[question.id] = formatOptionsForInput(question.options);
        }
      }
      setQuestionOptionsRaw(rawQuestionOptions);
    }
    if (step?.stepType === "DOCUMENT_SIGN") {
      const doc = config as { documentId?: string; documentName?: string; fileUrl?: string };
      setDocumentId(doc.documentId ?? "");
    }
    if (step?.stepType === "FILE_UPLOAD") {
      const upload = config as {
        instruction?: string;
        acceptedTypes?: string[];
        maxSizeMb?: number;
        referenceDocumentId?: string;
      };
      setUploadInstruction(upload.instruction ?? "");
      setAcceptedTypes(upload.acceptedTypes?.join(",") ?? ".pdf,.jpg,.jpeg,.png");
      setMaxSizeMb(upload.maxSizeMb ?? 10);
      setReferenceDocumentId(upload.referenceDocumentId ?? "");
    }
  }, [open, step]);

  function buildConfig(): Record<string, unknown> {
    switch (stepType) {
      case "FORM":
        return {
          fields: fields.map((field) =>
            field.type === "dropdown"
              ? {
                  ...field,
                  options: parseCommaSeparatedOptions(
                    fieldOptionsRaw[field.id] ?? formatOptionsForInput(field.options)
                  ),
                }
              : field
          ),
        };
      case "SURVEY":
        return {
          questions: questions.map((question) =>
            question.answerType === "multiple_choice"
              ? {
                  ...question,
                  options: parseCommaSeparatedOptions(
                    questionOptionsRaw[question.id] ?? formatOptionsForInput(question.options)
                  ),
                }
              : question
          ),
        };
      case "DOCUMENT_SIGN":
        return { documentId };
      case "FILE_UPLOAD":
        return {
          instruction: uploadInstruction,
          acceptedTypes: acceptedTypes.split(",").map((t) => t.trim()).filter(Boolean),
          maxSizeMb,
          ...(referenceDocumentId ? { referenceDocumentId } : {}),
        };
      default:
        return {};
    }
  }

  function addField() {
    setFields([
      ...fields,
      { id: newFieldId(), label: "", type: "text", required: false, placeholder: "" },
    ]);
  }

  function addQuestion() {
    setQuestions([
      ...questions,
      { id: newFieldId(), question: "", answerType: "short_text", required: false },
    ]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{step ? "Edit Step" : "Add Step"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>
              Step Title <span className="text-destructive">*</span>
            </Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Employee-facing Instructions</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Step Type</Label>
            <Select value={stepType} onValueChange={(v) => setStepType(v as FlowStep["stepType"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FORM">Form</SelectItem>
                <SelectItem value="DOCUMENT_SIGN">Document Sign</SelectItem>
                <SelectItem value="SURVEY">Survey</SelectItem>
                <SelectItem value="FILE_UPLOAD">File Upload</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {stepType === "FORM" && (
            <div className="space-y-3 border rounded-md p-3">
              <div className="flex items-center justify-between">
                <Label>Form Fields</Label>
                <Button type="button" variant="outline" size="sm" onClick={addField}>
                  <Plus className="h-4 w-4 mr-1" /> Add Field
                </Button>
              </div>
              {fields.map((field, idx) => (
                <div key={field.id} className="grid grid-cols-1 md:grid-cols-2 gap-2 border-b pb-3">
                  <Input
                    placeholder="Label"
                    value={field.label}
                    onChange={(e) => {
                      const next = [...fields];
                      next[idx] = { ...field, label: e.target.value };
                      setFields(next);
                    }}
                  />
                  <Select
                    value={field.type}
                    onValueChange={(v) => {
                      const next = [...fields];
                      next[idx] = { ...field, type: v as FormFieldType };
                      setFields(next);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="dropdown">Dropdown</SelectItem>
                      <SelectItem value="checkbox">Checkbox</SelectItem>
                      <SelectItem value="yes_no">Yes/No</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Placeholder"
                    value={field.placeholder ?? ""}
                    onChange={(e) => {
                      const next = [...fields];
                      next[idx] = { ...field, placeholder: e.target.value };
                      setFields(next);
                    }}
                  />
                  {field.type === "dropdown" && (
                    <Input
                      placeholder="Options (comma-separated)"
                      value={fieldOptionsRaw[field.id] ?? formatOptionsForInput(field.options)}
                      onChange={(e) =>
                        setFieldOptionsRaw((prev) => ({ ...prev, [field.id]: e.target.value }))
                      }
                    />
                  )}
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={field.required}
                      onCheckedChange={(checked) => {
                        const next = [...fields];
                        next[idx] = { ...field, required: !!checked };
                        setFields(next);
                      }}
                    />
                    <span className="text-sm">Required</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="ml-auto"
                      onClick={() => setFields(fields.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {stepType === "SURVEY" && (
            <div className="space-y-3 border rounded-md p-3">
              <div className="flex items-center justify-between">
                <Label>Questions</Label>
                <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                  <Plus className="h-4 w-4 mr-1" /> Add Question
                </Button>
              </div>
              {questions.map((q, idx) => (
                <div key={q.id} className="space-y-2 border-b pb-3">
                  <Input
                    placeholder="Question text"
                    value={q.question}
                    onChange={(e) => {
                      const next = [...questions];
                      next[idx] = { ...q, question: e.target.value };
                      setQuestions(next);
                    }}
                  />
                  <Select
                    value={q.answerType}
                    onValueChange={(v) => {
                      const next = [...questions];
                      next[idx] = { ...q, answerType: v as SurveyAnswerType };
                      setQuestions(next);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short_text">Short Text</SelectItem>
                      <SelectItem value="paragraph">Paragraph</SelectItem>
                      <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                      <SelectItem value="yes_no">Yes/No</SelectItem>
                      <SelectItem value="rating">Rating (1–5)</SelectItem>
                    </SelectContent>
                  </Select>
                  {q.answerType === "multiple_choice" && (
                    <Input
                      placeholder="Options (comma-separated)"
                      value={questionOptionsRaw[q.id] ?? formatOptionsForInput(q.options)}
                      onChange={(e) =>
                        setQuestionOptionsRaw((prev) => ({ ...prev, [q.id]: e.target.value }))
                      }
                    />
                  )}
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={q.required}
                      onCheckedChange={(checked) => {
                        const next = [...questions];
                        next[idx] = { ...q, required: !!checked };
                        setQuestions(next);
                      }}
                    />
                    <span className="text-sm">Required</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="ml-auto"
                      onClick={() => setQuestions(questions.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {stepType === "DOCUMENT_SIGN" && (
            <div className="space-y-3 border rounded-md p-3">
              <div className="space-y-2">
                <Label>
                  Select Document <span className="text-destructive">*</span>
                </Label>
                <Select value={documentId || undefined} onValueChange={setDocumentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose from Document Repository" />
                  </SelectTrigger>
                  <SelectContent>
                    <DocumentPickerOptions
                      companyWideDocuments={companyWideDocuments}
                      assignedDocuments={assignedDocuments}
                    />
                  </SelectContent>
                </Select>
                {!pickerDocuments.length && (
                  <p className="text-xs text-muted-foreground">
                    No active documents found. Add company-wide or assigned documents in the
                    Document Repository first.
                  </p>
                )}
              </div>
              {selectedDocument && (
                <div className="rounded-md bg-muted/50 p-3 space-y-2 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{selectedDocument.title}</span>
                    <DocumentTypeBadge type={selectedDocument.documentType} />
                    <span className="text-muted-foreground">v{selectedDocument.version}</span>
                  </div>
                  <p className="text-muted-foreground">{selectedDocument.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Employees will download this document, sign it, and upload their signed copy
                    to complete the step. This step always uses the latest version from the
                    repository.
                  </p>
                </div>
              )}
            </div>
          )}

          {stepType === "FILE_UPLOAD" && (
            <div className="space-y-3 border rounded-md p-3">
              <div className="space-y-2">
                <Label>Instruction</Label>
                <Textarea
                  value={uploadInstruction}
                  onChange={(e) => setUploadInstruction(e.target.value)}
                  placeholder='e.g. "Upload a copy of your photo ID"'
                />
              </div>
              <div className="space-y-2">
                <Label>Reference Document (optional)</Label>
                <Select
                  value={referenceDocumentId || "none"}
                  onValueChange={(v) => setReferenceDocumentId(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None — no reference document" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <DocumentPickerOptions
                      companyWideDocuments={companyWideDocuments}
                      assignedDocuments={assignedDocuments}
                    />
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Employees can download this template or example before uploading their file.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Accepted File Types</Label>
                <Input value={acceptedTypes} onChange={(e) => setAcceptedTypes(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Max Size (MB)</Label>
                <Input
                  type="number"
                  value={maxSizeMb}
                  onChange={(e) => setMaxSizeMb(Number(e.target.value))}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Switch checked={isRequired} onCheckedChange={setIsRequired} />
            <Label>Required step</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              !title ||
              isSaving ||
              (stepType === "DOCUMENT_SIGN" && !documentId)
            }
            onClick={() =>
              onSave({
                title,
                description: description || undefined,
                stepType,
                isRequired,
                config: buildConfig(),
              })
            }
          >
            Save Step
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
