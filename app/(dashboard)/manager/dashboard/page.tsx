import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Manager dashboard — presence overview placeholder until Phase 2 */
export default async function ManagerDashboardPage() {
  await requireRole(["MANAGER"]);

  return (
    <div>
      <PageHeader
        title="Manager Dashboard"
        description="Team presence and activity overview"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "In", color: "text-green-600" },
          { title: "Absent", color: "text-red-600" },
          { title: "On Leave", color: "text-blue-600" },
          { title: "Late", color: "text-amber-600" },
        ].map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-sm font-medium ${stat.color}`}>
                {stat.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">—</p>
              <p className="text-xs text-muted-foreground mt-1">Available in Phase 2</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
