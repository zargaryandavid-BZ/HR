import type { AuthUser } from "@/lib/auth";
import { Role } from "@prisma/client";

/** Check if the session can view an employee's individual settings data */
export function canViewEmployeeSettings(
  session: AuthUser,
  employeeId: string
): boolean {
  if (["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) return true;
  return session.employeeId === employeeId;
}

/** Check if the session can manage write-ups (create/edit) */
export function canManageWriteUps(session: AuthUser): boolean {
  return ["HR_ADMIN", "SUPER_ADMIN"].includes(session.role);
}

/** Check if the session can delete write-ups */
export function canDeleteWriteUps(session: AuthUser): boolean {
  return session.role === "SUPER_ADMIN";
}

/** Check if the session can view manager notes for an employee */
export function canViewNotes(
  session: AuthUser,
  employeeId: string,
  employeeDepartmentId: string | null
): boolean {
  if (["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) return true;
  if (session.role === "MANAGER") {
    return (
      session.employee?.departmentId != null &&
      session.employee.departmentId === employeeDepartmentId
    );
  }
  return false;
}

/** Check if the session can create manager notes */
export function canCreateNotes(session: AuthUser): boolean {
  return ["HR_ADMIN", "SUPER_ADMIN", "MANAGER"].includes(session.role);
}

/** Check if the session can create a note for a specific employee */
export function canCreateNoteForEmployee(
  session: AuthUser,
  employeeDepartmentId: string | null
): boolean {
  if (!canCreateNotes(session)) return false;
  if (["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) return true;
  if (session.role === "MANAGER") {
    return (
      session.employee?.departmentId != null &&
      session.employee.departmentId === employeeDepartmentId
    );
  }
  return false;
}

/** Check if the session is the author of a note */
export function isNoteAuthor(session: AuthUser, issuedBy: string): boolean {
  return session.id === issuedBy;
}

/** Check if the session can delete a note */
export function canDeleteNote(session: AuthUser, issuedBy: string): boolean {
  return session.role === "SUPER_ADMIN" || session.id === issuedBy;
}

/** Check if the session can send document reminders */
export function canRemindDocuments(session: AuthUser): boolean {
  return ["HR_ADMIN", "SUPER_ADMIN"].includes(session.role);
}

/** Check if the session can generate HR documents */
export function canGenerateHrDocuments(session: AuthUser): boolean {
  return ["HR_ADMIN", "SUPER_ADMIN"].includes(session.role);
}

/** Roles allowed for employee self-service views */
export const EMPLOYEE_SELF_ROLES: Role[] = [
  "EMPLOYEE",
  "MANAGER",
  "HR_ADMIN",
  "SUPER_ADMIN",
];
