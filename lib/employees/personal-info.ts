import { differenceInYears } from "date-fns";
import type { Employee, Prisma, Role, TShirtSize } from "@prisma/client";

type PersonalInfoInput = {
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  addressCountry?: string;
  birthdate?: string;
  tShirtSize?: string;
  allergies?: string;
};

type AddressBirthdateFields = {
  addressStreet?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZip?: string | null;
  addressCountry?: string | null;
  birthdate?: Date | null;
  tShirtSize?: TShirtSize | null;
  allergies?: string | null;
};

/** Calculate age from a birthdate */
export function calculateAge(birthdate: Date): number {
  return differenceInYears(new Date(), birthdate);
}

/** Validate birthdate is not in the future and employee is at least 16 */
export function isValidBirthdate(dateStr: string | undefined): boolean {
  if (!dateStr) return true;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime()) || date > new Date()) return false;
  return calculateAge(date) >= 16;
}

/** Build create/update data for address and birthdate fields */
export function buildAddressBirthdateData(data: PersonalInfoInput): AddressBirthdateFields {
  const result: AddressBirthdateFields = {};

  if (data.addressStreet !== undefined) result.addressStreet = data.addressStreet || null;
  if (data.addressCity !== undefined) result.addressCity = data.addressCity || null;
  if (data.addressState !== undefined) result.addressState = data.addressState || null;
  if (data.addressZip !== undefined) result.addressZip = data.addressZip || null;
  if (data.addressCountry !== undefined) result.addressCountry = data.addressCountry || "US";
  if (data.birthdate !== undefined) {
    result.birthdate = data.birthdate ? new Date(data.birthdate) : null;
  }
  if (data.tShirtSize !== undefined) {
    result.tShirtSize = (data.tShirtSize as TShirtSize) || null;
  }
  if (data.allergies !== undefined) {
    result.allergies = data.allergies?.trim() || null;
  }

  return result;
}

type EmployeeWithRelations = Employee & {
  department?: { id: string; name: string } | null;
  manager?: { id: string; firstName: string; lastName: string } | null;
  user?: { id: string; email: string; role: Role } | null;
};

/** Sanitize employee response for API output */
export function sanitizeEmployeeResponse<T extends EmployeeWithRelations>(
  employee: T,
  _role: Role
): T & { age: number | null } {
  const birthdate = employee.birthdate;
  const age = birthdate ? calculateAge(birthdate) : null;

  return {
    ...employee,
    age,
  };
}

/** Prisma select for employee list */
export const employeeListSelect = {
  id: true,
  firstName: true,
  lastName: true,
  preferredName: true,
  workEmail: true,
  jobTitle: true,
  scheduleType: true,
  status: true,
  isNonExempt: true,
  startDate: true,
  positionId: true,
  departmentId: true,
  department: { select: { id: true, name: true } },
} satisfies Prisma.EmployeeSelect;
