import { Clock } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

/** Admin timesheet placeholder until Phase 2 time management is built */
export function AdminTimesheetPlaceholder() {
  return (
    <div>
      <PageHeader
        title="Timesheet"
        description="Employee time entry grid and attendance management"
      />

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-sm max-w-md">
            The timesheet grid, QR kiosk clock-in, and presence dashboard will be
            available in Phase 2.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
