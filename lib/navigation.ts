import {
  type LucideIcon,
  LayoutDashboard,
  Users,
  Clock,
  Calendar,
  CalendarClock,
  Wallet,
  FileText,
  Settings,
  UserCircle,
  BarChart3,
  Bell,
  UserPlus,
  UserMinus,
  ScanLine,
  Briefcase,
} from "lucide-react";
import { Role } from "@prisma/client";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: Role[];
  /** When true, only show for employees with an active onboarding instance */
  requiresActiveOnboarding?: boolean;
  /** When set, fetch a badge count from this API path */
  badgeCountPath?: string;
  /** When set, show count inline in the label e.g. "Employees (12)" */
  inlineCountPath?: string;
};

export type NavSubItem = {
  label: string;
  href: string;
  /** API path returning { pendingCount: number } or { count: number } for sidebar badge */
  badgeCountPath?: string;
};

export type NavGroup = {
  label: string;
  icon: LucideIcon;
  roles: Role[];
  items: NavSubItem[];
};

/** Grouped sidebar navigation for HR Admin (unused — items promoted to NAV_ITEMS) */
export const NAV_GROUPS: NavGroup[] = [];

/** Sidebar navigation items grouped by role access */
export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/employee/dashboard",
    icon: LayoutDashboard,
    roles: ["EMPLOYEE"],
  },
  {
    label: "My Time",
    href: "/employee/time",
    icon: Clock,
    roles: ["EMPLOYEE"],
  },
  {
    label: "My Leave",
    href: "/employee/leave",
    icon: Calendar,
    roles: ["EMPLOYEE"],
  },
  {
    label: "Documents",
    href: "/employee/documents",
    icon: FileText,
    roles: ["EMPLOYEE"],
    badgeCountPath: "/api/employee/documents/unacknowledged-count",
  },
  {
    label: "My Onboarding",
    href: "/employee/onboarding",
    icon: UserPlus,
    roles: ["EMPLOYEE"],
    requiresActiveOnboarding: true,
  },
  {
    label: "My Profile",
    href: "/employee/profile",
    icon: UserCircle,
    roles: ["EMPLOYEE"],
  },
  {
    label: "Dashboard",
    href: "/manager/dashboard",
    icon: LayoutDashboard,
    roles: ["MANAGER"],
  },
  {
    label: "Presence",
    href: "/manager/presence",
    icon: Users,
    roles: ["MANAGER"],
  },
  {
    label: "Timesheet",
    href: "/manager/timesheet",
    icon: Clock,
    roles: ["MANAGER"],
  },
  {
    label: "Leave Approvals",
    href: "/manager/leave-approvals",
    icon: Calendar,
    roles: ["MANAGER"],
  },
  {
    label: "Team Calendar",
    href: "/manager/calendar",
    icon: Calendar,
    roles: ["MANAGER"],
  },
  {
    label: "Onboarding",
    href: "/manager/onboarding",
    icon: UserPlus,
    roles: ["MANAGER"],
  },
  {
    label: "Reports",
    href: "/manager/reports",
    icon: BarChart3,
    roles: ["MANAGER"],
  },
  {
    label: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
    roles: ["HR_ADMIN", "SUPER_ADMIN"],
  },
  {
    label: "Timesheet",
    href: "/admin/timesheet",
    icon: Clock,
    roles: ["HR_ADMIN", "SUPER_ADMIN"],
  },
  {
    label: "Employees",
    href: "/admin/employees",
    icon: Users,
    roles: ["HR_ADMIN", "SUPER_ADMIN"],
    inlineCountPath: "/api/employees/count",
  },
  {
    label: "Job Offers",
    href: "/admin/offers",
    icon: Briefcase,
    roles: ["HR_ADMIN", "SUPER_ADMIN"],
  },
  {
    label: "Leave Requests",
    href: "/admin/leave",
    icon: CalendarClock,
    roles: ["HR_ADMIN", "SUPER_ADMIN"],
    badgeCountPath: "/api/leave/stats",
  },
  {
    label: "Leave Balances",
    href: "/admin/leave/balances",
    icon: Wallet,
    roles: ["HR_ADMIN", "SUPER_ADMIN"],
  },
  {
    label: "Onboarding",
    href: "/admin/onboarding/automation",
    icon: UserPlus,
    roles: ["HR_ADMIN", "SUPER_ADMIN"],
  },
  {
    label: "Offboarding",
    href: "/admin/offboarding/automation",
    icon: UserMinus,
    roles: ["HR_ADMIN", "SUPER_ADMIN"],
  },
  {
    label: "Documents",
    href: "/admin/documents",
    icon: FileText,
    roles: ["HR_ADMIN", "SUPER_ADMIN"],
  },
  {
    label: "Settings",
    href: "/admin/settings/company",
    icon: Settings,
    roles: ["HR_ADMIN", "SUPER_ADMIN"],
  },
  {
    label: "Notifications",
    href: "/admin/notifications",
    icon: Bell,
    roles: ["HR_ADMIN", "SUPER_ADMIN"],
  },
  {
    label: "Notifications",
    href: "/notifications",
    icon: Bell,
    roles: ["EMPLOYEE", "MANAGER"],
  },
];

/** Filter nav items visible to a given role */
export function getNavItemsForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

/** Filter nav groups visible to a given role */
export function getNavGroupsForRole(role: Role): NavGroup[] {
  return NAV_GROUPS.filter((group) => group.roles.includes(role));
}

/** Settings sub-navigation for admin */
export const SETTINGS_NAV = [
  { label: "Company", href: "/admin/settings/company" },
  { label: "Departments", href: "/admin/settings/departments" },
  { label: "Positions", href: "/admin/settings/positions" },
  { label: "Leave Types", href: "/admin/settings/leave-types" },
  { label: "Holidays", href: "/admin/settings/holidays" },
  { label: "Location Zones", href: "/admin/settings/location-zones" },
];
