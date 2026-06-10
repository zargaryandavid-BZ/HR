import { z } from "zod";
import { differenceInYears, isFuture } from "date-fns";
import {
  PHONE_REGEX,
  WEEKDAY_KEYS,
  validateCustomSchedule,
  getDefaultCustomSchedule,
  type CustomScheduleConfig,
} from "@/lib/schedule";
import {
  EMPLOYEE_SECTION_FIELDS,
  type EmployeeFormSection,
} from "@/lib/employees/form-sections";

const timeSlotSchema = z.object({
  start: z.string(),
  end: z.string(),
});

const customDaysSchema = z.object({
  MON: z.array(timeSlotSchema),
  TUE: z.array(timeSlotSchema),
  WED: z.array(timeSlotSchema),
  THU: z.array(timeSlotSchema),
  FRI: z.array(timeSlotSchema),
  SAT: z.array(timeSlotSchema),
  SUN: z.array(timeSlotSchema),
});

export const customScheduleConfigSchema = z.object({
  type: z.literal("CUSTOM"),
  days: customDaysSchema,
});

export const scheduleConfigSchema = z.discriminatedUnion("type", [
  customScheduleConfigSchema,
  z.object({
    type: z.literal("SHIFT_BASED"),
    shiftTemplateName: z.string().min(1, "Shift template name is required"),
    workingDays: z.array(z.number().min(0).max(6)).min(1, "Select at least one working day"),
  }),
  z.object({
    type: z.literal("HOURS_BASED"),
    period: z.enum(["DAILY", "WEEKLY"]),
    requiredHours: z.number().positive("Required hours must be positive"),
  }),
  z.object({
    type: z.literal("FLEXIBLE"),
    weeklyTargetHours: z.number().positive().optional(),
  }),
]);

const optionalPhoneSchema = z
  .string()
  .optional()
  .refine((val) => !val || PHONE_REGEX.test(val), {
    message: "Phone number must contain numbers only",
  });

const employeePhoneSchema = z
  .string()
  .min(1, "Phone is required")
  .regex(PHONE_REGEX, "Valid phone number required");

const requiredPhoneSchema = z
  .string()
  .min(1, "Emergency contact phone is required")
  .regex(PHONE_REGEX, "Valid phone number required");

const optionalZipSchema = z
  .string()
  .optional()
  .refine((val) => !val || /^\d{5}(-\d{4})?$/.test(val), {
    message: "ZIP code must be 5 digits or 5+4 format (12345 or 12345-6789)",
  });

const optionalBirthdateSchema = z.string().optional();

function validateBirthdateField(dateStr: string | undefined, ctx: z.RefinementCtx, path: string[]) {
  if (!dateStr) return;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid birthdate", path });
    return;
  }
  if (isFuture(date)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Birthdate cannot be in the future", path });
    return;
  }
  if (differenceInYears(new Date(), date) < 16) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Employee must be at least 16 years old",
      path,
    });
  }
}

const personalInfoFields = {
  addressStreet: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressZip: optionalZipSchema,
  addressCountry: z.string().optional(),
  birthdate: optionalBirthdateSchema,
  tShirtSize: z.enum(["XS", "S", "M", "L", "XL", "XXL", "XXXL"]).optional(),
  allergies: z.string().max(500, "Allergies must be 500 characters or fewer").optional(),
};

const baseEmployeeFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  preferredName: z.string().optional(),
  personalEmail: z.string().email().optional().or(z.literal("")),
  workEmail: z.string().email("Valid work email is required"),
  phone: employeePhoneSchema,
  departmentId: z.string().min(1, "Department is required"),
  positionId: z.string().optional(),
  jobTitle: z.string().min(1, "Job title is required"),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT"], {
    required_error: "Employment type is required",
  }),
  managerId: z.string().optional(),
  payType: z.enum(["HOURLY", "SALARY"]),
  isNonExempt: z.boolean().optional(),
  startDate: z.string().min(1, "Start date is required"),
  scheduleType: z.enum(["FIXED", "SHIFT_BASED", "HOURS_BASED", "FLEXIBLE"]),
  scheduleConfig: scheduleConfigSchema,
  emergencyContactName: z.string().min(1, "Emergency contact name is required"),
  emergencyContactPhone: requiredPhoneSchema,
  emergencyContactRelation: z.string().min(1, "Relationship is required"),
  // Compensation (HR-only fields)
  payRate: z.coerce.number().nonnegative().optional(),
  payFrequency: z.enum(["WEEKLY", "BIWEEKLY", "SEMI_MONTHLY", "MONTHLY"]).optional(),
  overtimeEligible: z.boolean().optional(),
  compensationEffectiveDate: z.string().optional(),
  mealBreak1WaiverEnabled: z.boolean().optional(),
  mealBreak2WaiverEnabled: z.boolean().optional(),
  ...personalInfoFields,
});

export const employeeFormSchema = baseEmployeeFormSchema.superRefine((data, ctx) => {
  validateBirthdateField(data.birthdate, ctx, ["birthdate"]);

  if (data.scheduleType === "FIXED") {
    if (data.scheduleConfig.type !== "CUSTOM") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Fixed schedule requires weekly day configuration",
        path: ["scheduleConfig"],
      });
      return;
    }
    const error = validateCustomSchedule(data.scheduleConfig as CustomScheduleConfig);
    if (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error,
        path: ["scheduleConfig"],
      });
    }
  }
});

function applyEmployeePatchRefinements(
  data: Partial<z.infer<typeof baseEmployeeFormSchema>>,
  ctx: z.RefinementCtx,
  fields: Set<keyof z.infer<typeof baseEmployeeFormSchema>>
) {
  if (fields.has("birthdate") && data.birthdate !== undefined) {
    validateBirthdateField(data.birthdate, ctx, ["birthdate"]);
  }
  if (fields.has("scheduleType") || fields.has("scheduleConfig")) {
    if (data.scheduleType === "FIXED" && data.scheduleConfig !== undefined) {
      if (data.scheduleConfig.type !== "CUSTOM") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Fixed schedule requires weekly day configuration",
          path: ["scheduleConfig"],
        });
        return;
      }
      const error = validateCustomSchedule(data.scheduleConfig as CustomScheduleConfig);
      if (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: error,
          path: ["scheduleConfig"],
        });
      }
    }
  }
}

/** Partial schema for PATCH employee updates */
export const employeeFormPatchSchema = baseEmployeeFormSchema
  .partial()
  .superRefine((data, ctx) => {
    applyEmployeePatchRefinements(
      data,
      ctx,
      new Set(Object.keys(baseEmployeeFormSchema.shape) as (keyof z.infer<typeof baseEmployeeFormSchema>)[])
    );
  });

type EmployeeFormField = keyof z.infer<typeof baseEmployeeFormSchema>;

/** Build a PATCH schema that only validates fields on the active employee detail tab */
export function buildEmployeeSectionPatchSchema(sections: EmployeeFormSection[]) {
  const fieldKeys = new Set<EmployeeFormField>(
    sections.flatMap((section) => EMPLOYEE_SECTION_FIELDS[section] as EmployeeFormField[])
  );
  const shape = Object.fromEntries(
    [...fieldKeys].map((key) => {
      if (key === "phone") {
        return [key, employeePhoneSchema];
      }
      return [key, baseEmployeeFormSchema.shape[key].optional()];
    })
  );

  return z.object(shape).superRefine((data, ctx) => {
    applyEmployeePatchRefinements(
      data as Partial<z.infer<typeof baseEmployeeFormSchema>>,
      ctx,
      fieldKeys
    );
  });
}

export const employeeLeaveBalanceItemSchema = z.object({
  leaveTypeId: z.string().min(1),
  allowance: z.coerce.number().min(0),
  reason: z.string().optional(),
});

export const employeeLeaveBalancesSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  balances: z.array(employeeLeaveBalanceItemSchema).min(1),
});

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

export const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

export const resetPasswordSchema = z.object({
  email: z.string().email("Valid email is required"),
});

export const changePasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const departmentSchema = z.object({
  name: z.string().min(1, "Department name is required"),
  description: z.string().optional(),
});

export const positionSchema = z.object({
  name: z.string().min(1, "Position name is required"),
  description: z.string().optional(),
  departmentId: z.string().min(1, "Department is required"),
});

export const positionPatchSchema = positionSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const formFieldSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  type: z.enum(["text", "number", "date", "email", "phone", "dropdown", "checkbox", "yes_no"]),
  options: z.array(z.string()).optional(),
  required: z.boolean(),
  placeholder: z.string().optional(),
});

const surveyQuestionSchema = z.object({
  id: z.string(),
  question: z.string().min(1),
  answerType: z.enum(["short_text", "paragraph", "multiple_choice", "yes_no", "rating"]),
  options: z.array(z.string()).optional(),
  required: z.boolean(),
});

export const onboardingStepSchema = z.object({
  title: z.string().min(1, "Step title is required"),
  description: z.string().optional(),
  stepType: z.enum(["FORM", "DOCUMENT_SIGN", "SURVEY", "FILE_UPLOAD"]),
  isRequired: z.boolean().default(true),
  config: z.record(z.unknown()),
});

export const onboardingTemplateSchema = z.object({
  name: z.string().min(1, "Flow name is required"),
  description: z.string().optional(),
  estimatedCompletionTime: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const offboardingTemplateSchema = onboardingTemplateSchema;
export const offboardingStepSchema = onboardingStepSchema;

export const triggerOnboardingSchema = z.object({
  employeeId: z.string().min(1),
  templateId: z.string().min(1),
});

export const portalNotificationSchema = z.object({
  topic: z.enum([
    "GENERAL_REVIEW",
    "DOCUMENT_SIGNATURE",
    "DOCUMENT_UPDATE",
    "ONBOARDING_TASK",
    "WRITEUP_ACKNOWLEDGMENT",
    "LEAVE_REQUEST",
    "PROFILE_UPDATE",
    "SCHEDULE_UPDATE",
    "HR_DOCUMENT",
    "IDENTITY_DOCUMENT",
  ]),
  channels: z
    .object({
      email: z.boolean(),
      sms: z.boolean(),
    })
    .refine((channels) => channels.email || channels.sms, {
      message: "Select at least one channel (Email or SMS)",
    }),
  customMessage: z
    .string()
    .max(500, "Additional message must be 500 characters or fewer")
    .optional(),
});

export { formFieldSchema, surveyQuestionSchema };

export const leaveTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  defaultDays: z.coerce.number().min(0),
  accrualType: z.enum(["LUMP_SUM", "ACCRUED"]),
  isPaid: z.boolean(),
});

export const documentTypeSchema = z.enum([
  "SOP",
  "POLICY",
  "NDA",
  "TAX_FORM",
  "SAFETY_DOCUMENT",
  "TRAINING_MATERIAL",
  "EMPLOYEE_AGREEMENT",
  "ONBOARDING_DOCUMENT",
  "OTHER",
]);

export const documentScopeSchema = z.enum(["COMPANY_WIDE", "POSITION_SPECIFIC"]);

export const documentCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  documentType: documentTypeSchema,
  fileUrl: z.string().min(1, "PDF file is required"),
  isActive: z.boolean().default(true),
  scope: documentScopeSchema.default("POSITION_SPECIFIC"),
  departmentIds: z.array(z.string().min(1)).default([]),
  positionIds: z.array(z.string().min(1)).default([]),
});

export const documentUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  documentType: documentTypeSchema.optional(),
  fileUrl: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  versionIncremented: z.boolean().optional(),
  scope: documentScopeSchema.optional(),
  departmentIds: z.array(z.string().min(1)).optional(),
  positionIds: z.array(z.string().min(1)).optional(),
});

export const documentAssignSchema = z.object({
  employeeIds: z.array(z.string().min(1)).default([]),
  positionIds: z.array(z.string().min(1)).default([]),
  departmentIds: z.array(z.string().min(1)).default([]),
});

export const documentNotifySchema = z.object({
  version: z.number().int().positive(),
});

export const holidaySchema = z.object({
  name: z.string().min(1, "Holiday name is required"),
  date: z.string().min(1, "Date is required"),
  isPaid: z.boolean(),
  isRecurringAnnually: z.boolean(),
  isCompanyWide: z.boolean().default(true),
});

export const locationZoneSchema = z.object({
  name: z.string().min(1, "Zone name is required"),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radiusMeters: z.coerce.number().positive("Radius must be positive"),
  isActive: z.boolean().default(true),
});

export const companySettingsSchema = z.object({
  overtimeThresholdHours: z.coerce.number().positive(),
  coverageWarningPercent: z.coerce.number().min(0).max(100),
  lateThresholdMinutes: z.coerce.number().min(0),
  yearEndRolloverPolicy: z.enum(["CARRY_OVER", "EXPIRE", "CASH_OUT"]),
});

export const WORKING_DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export { getDefaultCustomSchedule, WEEKDAY_KEYS };
