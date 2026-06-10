import { Role } from "@prisma/client";

/** Check if user has one of the allowed roles */
export function hasRole(role: Role | null | undefined, allowedRoles: Role[]): boolean {
  if (!role) return false;
  return allowedRoles.includes(role);
}

/** HR Admin and Super Admin share most admin permissions */
export function isHrAdmin(role: Role): boolean {
  return role === "HR_ADMIN" || role === "SUPER_ADMIN";
}

/** Manager or above can manage team data */
export function isManagerOrAbove(role: Role): boolean {
  return role === "MANAGER" || isHrAdmin(role);
}
