import { cn } from "@/lib/utils";

type DashboardPanelProps = {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/** Shared card shell for admin dashboard list panels */
export function DashboardPanel({
  title,
  badge,
  children,
  className,
}: DashboardPanelProps) {
  return (
    <div className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {badge}
      </div>
      <div>{children}</div>
    </div>
  );
}

type CountBadgeProps = {
  count: number;
  label: string;
  className: string;
};

/** Header count chip used across dashboard panels */
export function CountBadge({ count, label, className }: CountBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        className
      )}
    >
      {count} {label}
    </span>
  );
}

type EmployeeAvatarProps = {
  employeeId: string;
  firstName: string;
  lastName: string;
  colorClass: string;
};

/** Colored initials avatar for dashboard rows */
export function EmployeeAvatar({
  firstName,
  lastName,
  colorClass,
}: EmployeeAvatarProps) {
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();

  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
        colorClass
      )}
    >
      {initials}
    </div>
  );
}

/** Empty row message for dashboard panels */
export function DashboardEmptyState({
  message,
  icon,
}: {
  message: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
      {icon}
      <p>{message}</p>
    </div>
  );
}
