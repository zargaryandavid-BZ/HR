/** Form field types for FORM onboarding steps */
export type FormFieldType =
  | "text"
  | "number"
  | "date"
  | "email"
  | "phone"
  | "dropdown"
  | "checkbox"
  | "yes_no";

export type FormFieldConfig = {
  id: string;
  label: string;
  type: FormFieldType;
  options?: string[];
  required: boolean;
  placeholder?: string;
};

export type FormStepConfig = {
  fields: FormFieldConfig[];
};

export type DocumentSignStepConfig = {
  /** Reference to a document in the repository */
  documentId?: string;
  /** Legacy fields for steps created before repository integration */
  documentName?: string;
  fileUrl?: string;
  acknowledgmentText?: string;
};

export type SurveyAnswerType =
  | "short_text"
  | "paragraph"
  | "multiple_choice"
  | "yes_no"
  | "rating";

export type SurveyQuestionConfig = {
  id: string;
  question: string;
  answerType: SurveyAnswerType;
  options?: string[];
  required: boolean;
};

export type SurveyStepConfig = {
  questions: SurveyQuestionConfig[];
};

export type FileUploadStepConfig = {
  instruction: string;
  acceptedTypes: string[];
  maxSizeMb: number;
  /** Optional reference document from the repository */
  referenceDocumentId?: string;
};

export type OnboardingStepConfig =
  | FormStepConfig
  | DocumentSignStepConfig
  | SurveyStepConfig
  | FileUploadStepConfig;
