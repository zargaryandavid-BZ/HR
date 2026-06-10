import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type EmployeeClassificationBadgeProps = {
  isNonExempt: boolean;
  className?: string;
};

/** Subtle Non-Exempt / Exempt badge for employee list and profile header */
export function EmployeeClassificationBadge({
  isNonExempt,
  className,
}: EmployeeClassificationBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium text-[10px] uppercase tracking-wide",
        isNonExempt
          ? "border-blue-300 text-blue-700 bg-blue-50"
          : "border-muted-foreground/30 text-muted-foreground bg-muted/30",
        className
      )}
    >
      {isNonExempt ? "Non-Exempt" : "Exempt"}
    </Badge>
  );
}
