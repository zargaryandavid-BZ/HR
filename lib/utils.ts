import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind CSS classes with conflict resolution */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a full name from first/last/preferred name parts */
export function formatEmployeeName(
  firstName: string,
  lastName: string,
  preferredName?: string | null
): string {
  const display = preferredName || firstName;
  return `${display} ${lastName}`.trim();
}

/** Get initials for avatar display */
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/** Format leave balance days/hours — one decimal when fractional (e.g. 4.7), whole when integer */
export function formatLeaveBalanceValue(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Alias for hour-based leave balance display */
export const formatLeaveBalanceHours = formatLeaveBalanceValue;

/** Role-based dashboard path for redirect after login */
export function getDashboardPathForRole(
  role: "SUPER_ADMIN" | "HR_ADMIN" | "MANAGER" | "EMPLOYEE"
): string {
  switch (role) {
    case "SUPER_ADMIN":
    case "HR_ADMIN":
      return "/admin/dashboard";
    case "MANAGER":
      return "/manager/dashboard";
    case "EMPLOYEE":
      return "/employee/dashboard";
  }
}
