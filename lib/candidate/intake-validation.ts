import { z } from "zod";
import { differenceInYears, isFuture } from "date-fns";
import { parseFormDate } from "@/lib/dates";
import { US_STATES } from "@/lib/constants/us-states";
import { PHONE_REGEX, normalizePhoneOnBlur } from "@/lib/schedule";

export const T_SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] as const;
const US_STATE_CODES = US_STATES.map((state) => state.code) as [string, ...string[]];

const optionalTrimmedString = z.string().trim().optional();
const optionalEmailSchema = z.union([z.literal(""), z.string().trim().email("Valid email required")]).optional();
const optionalStateSchema = z.union([z.literal(""), z.enum(US_STATE_CODES)]).optional();
const optionalZipSchema = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || /^\d{5}$/.test(value), {
    message: "ZIP code must be exactly 5 digits",
  });

const optionalUrlSchema = z.union([z.literal(""), z.string().trim().url("Invalid file URL")]).optional();

/** Base ZodObject — exported so callers can use .omit()/.pick() before superRefine wraps it */
export const candidateIntakeBaseSchema = z.object({
    phone: z
      .string()
      .trim()
      .min(1, "Phone number required")
      .regex(PHONE_REGEX, "Valid phone number required"),
    personalEmail: optionalEmailSchema,
    birthdate: optionalTrimmedString,
    addressStreet: optionalTrimmedString,
    addressCity: optionalTrimmedString,
    addressState: optionalStateSchema,
    addressZip: optionalZipSchema,
    addressCountry: optionalTrimmedString,
    emergencyContactName: z.string().trim().min(1, "Emergency contact name required"),
    emergencyContactPhone: z
      .string()
      .trim()
      .min(1, "Emergency contact phone required")
      .regex(PHONE_REGEX, "Valid emergency contact phone required"),
    emergencyContactRelation: z.string().trim().min(1, "Relationship required"),
    emergencyContactConsent: z.boolean().refine((value) => value, {
      message: "Emergency contact authorization is required",
    }),
    tShirtSize: z.union([z.literal(""), z.enum(T_SHIRT_SIZES)]).optional(),
    allergies: z.string().trim().max(500, "Allergies must be 500 characters or fewer").optional(),
    idFileUrl: optionalUrlSchema,
    idFileName: optionalTrimmedString,
  });

/** Shared candidate intake schema for client + API (includes cross-field validation) */
export const candidateIntakeSchema = candidateIntakeBaseSchema.superRefine((data, ctx) => {
    if (data.birthdate) {
      let birthdate: Date;
      try {
        birthdate = parseFormDate(data.birthdate);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid birthdate",
          path: ["birthdate"],
        });
        return;
      }
      if (isFuture(birthdate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Birthdate cannot be in the future",
          path: ["birthdate"],
        });
      } else if (differenceInYears(new Date(), birthdate) < 16) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Employee must be at least 16 years old",
          path: ["birthdate"],
        });
      }
    }

    if (Boolean(data.idFileUrl) !== Boolean(data.idFileName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Uploaded document must include both file URL and file name",
        path: ["idFileName"],
      });
    }

    if (
      data.phone &&
      data.emergencyContactPhone &&
      normalizePhoneOnBlur(data.phone) === normalizePhoneOnBlur(data.emergencyContactPhone)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Emergency contact phone must be different from your phone",
        path: ["emergencyContactPhone"],
      });
    }
  });

export type CandidateIntakeInput = z.input<typeof candidateIntakeSchema>;
export type CandidateIntakeValues = z.output<typeof candidateIntakeSchema>;

type CandidateIntakeNormalized = {
  phone: string;
  personalEmail: string | null;
  birthdate: Date | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  addressCountry: string | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  emergencyContactConsent: true;
  tShirtSize: (typeof T_SHIRT_SIZES)[number] | null;
  allergies: string | null;
  idFileUrl: string | null;
  idFileName: string | null;
};

function normalizeOptionalValue(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Normalize validated intake values for DB writes */
export function normalizeCandidateIntake(values: CandidateIntakeValues): CandidateIntakeNormalized {
  const phone = normalizePhoneOnBlur(values.phone);
  const emergencyContactPhone = normalizePhoneOnBlur(values.emergencyContactPhone);
  const personalEmailRaw = normalizeOptionalValue(values.personalEmail);
  const addressStreet = normalizeOptionalValue(values.addressStreet);
  const addressCity = normalizeOptionalValue(values.addressCity);
  const addressState = normalizeOptionalValue(values.addressState)?.toUpperCase() ?? null;
  const addressZip = normalizeOptionalValue(values.addressZip);
  const addressCountryInput = normalizeOptionalValue(values.addressCountry);
  const hasAddressValue = Boolean(addressStreet || addressCity || addressState || addressZip || addressCountryInput);
  const addressCountry = hasAddressValue ? (addressCountryInput?.toUpperCase() ?? "US") : null;

  return {
    phone,
    personalEmail: personalEmailRaw?.toLowerCase() ?? null,
    birthdate: values.birthdate ? parseFormDate(values.birthdate) : null,
    addressStreet,
    addressCity,
    addressState,
    addressZip,
    addressCountry,
    emergencyContactName: values.emergencyContactName.trim(),
    emergencyContactPhone,
    emergencyContactRelation: values.emergencyContactRelation.trim(),
    emergencyContactConsent: true,
    tShirtSize: (normalizeOptionalValue(values.tShirtSize) as (typeof T_SHIRT_SIZES)[number] | null) ?? null,
    allergies: normalizeOptionalValue(values.allergies),
    idFileUrl: normalizeOptionalValue(values.idFileUrl),
    idFileName: normalizeOptionalValue(values.idFileName),
  };
}
