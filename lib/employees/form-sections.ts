export type EmployeeFormSection =
  | "contact"
  | "employment"
  | "compensation"
  | "personal"
  | "schedule"
  | "emergency";

export const EMPLOYEE_SECTION_FIELDS: Record<EmployeeFormSection, string[]> = {
  contact: [
    "firstName",
    "lastName",
    "preferredName",
    "personalEmail",
    "workEmail",
    "phone",
  ],
  employment: [
    "departmentId",
    "positionId",
    "jobTitle",
    "employmentType",
    "managerId",
    "payType",
    "startDate",
    "isNonExempt",
  ],
  compensation: [
    "payRate",
    "payFrequency",
    "overtimeEligible",
    "compensationEffectiveDate",
  ],
  personal: [
    "addressStreet",
    "addressCity",
    "addressState",
    "addressZip",
    "addressCountry",
    "birthdate",
  ],
  schedule: ["scheduleType", "scheduleConfig"],
  emergency: [
    "emergencyContactName",
    "emergencyContactPhone",
    "emergencyContactRelation",
  ],
};

/** Pick only the form fields belonging to visible sections for tab saves */
export function pickSectionPayload<T extends Record<string, unknown>>(
  data: T,
  activeSections: EmployeeFormSection[]
): Partial<T> {
  const keys = new Set(
    activeSections.flatMap((section) => EMPLOYEE_SECTION_FIELDS[section])
  );
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => keys.has(key))
  ) as Partial<T>;
}

/** Treat empty strings as omitted so partial PATCH validation does not fail on hidden tabs */
export function stripEmptyStrings<T extends Record<string, unknown>>(
  data: T
): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== "")
  ) as Partial<T>;
}

export const EMPLOYEE_TAB_SAVE_LABELS: Record<string, string> = {
  "contact,employment": "Profile",
  "contact,employment,compensation": "Profile",
  compensation: "Compensation",
  "personal,emergency": "Personal Information",
  schedule: "Schedule",
  emergency: "Emergency Contact",
  contact: "Contact Information",
  employment: "Employment Details",
  personal: "Personal Information",
};

/** Resolve the save button label for a sectioned employee form */
export function getEmployeeTabSaveLabel(sections: EmployeeFormSection[]): string {
  if (sections.length === 1) {
    return `Save ${EMPLOYEE_TAB_SAVE_LABELS[sections[0]] ?? "Changes"}`;
  }
  const key = sections.join(",");
  if (EMPLOYEE_TAB_SAVE_LABELS[key]) {
    return `Save ${EMPLOYEE_TAB_SAVE_LABELS[key]}`;
  }
  return "Save Changes";
}
