import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { T_SHIRT_SIZE_LABELS } from "@/lib/employees/personal-info-constants";
import type { TShirtSize } from "@prisma/client";

type EmployeePreferencesReadonlyProps = {
  tShirtSize?: TShirtSize | null;
  allergies?: string | null;
  /** Render as a column panel without an outer Card wrapper */
  embedded?: boolean;
};

/** Read-only display of employee-owned preference fields for HR admin */
export function EmployeePreferencesReadonly({
  tShirtSize,
  allergies,
  embedded = false,
}: EmployeePreferencesReadonlyProps) {
  const content = (
    <dl className="grid grid-cols-1 gap-4 text-sm">
      <div>
        <dt className="text-muted-foreground">T-shirt size</dt>
        <dd className="font-medium mt-0.5">
          {tShirtSize ? T_SHIRT_SIZE_LABELS[tShirtSize] : "—"}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Allergy info</dt>
        <dd className="font-medium mt-0.5 whitespace-pre-wrap">
          {allergies?.trim() ? allergies : "—"}
        </dd>
      </div>
    </dl>
  );

  if (embedded) {
    return (
      <div className="h-full rounded-xl border bg-card p-5">
        <div className="mb-4">
          <h3 className="text-base font-semibold">Preferences</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Managed by the employee in their portal — read-only here.
          </p>
        </div>
        {content}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <p className="text-sm text-muted-foreground">
          Managed by the employee in their portal — read-only here.
        </p>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
