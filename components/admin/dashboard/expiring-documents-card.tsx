import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import {
  CountBadge,
  DashboardEmptyState,
  DashboardPanel,
} from "@/components/admin/dashboard/dashboard-panel";
import { formatShortDate } from "@/lib/admin/dashboard-utils";
import { ID_DOC_TYPE_LABELS } from "@/lib/identity-documents/constants";
import { cn } from "@/lib/utils";
import type { AdminDashboardData } from "@/lib/admin/dashboard-data";

type ExpiringDocumentsCardProps = {
  documents: AdminDashboardData["expiringDocuments"];
  totalCount: number;
};

/** Identity documents expiring soon across active employees */
export function ExpiringDocumentsCard({
  documents,
  totalCount,
}: ExpiringDocumentsCardProps) {
  return (
    <DashboardPanel
      title="Expiring soon documents"
      badge={
        totalCount > 0 ? (
          <CountBadge
            count={totalCount}
            label="expiring"
            className="border-amber-200 bg-amber-50 text-amber-700"
          />
        ) : undefined
      }
    >
      {documents.length === 0 ? (
        <DashboardEmptyState
          message="No documents expiring in the next 30 days."
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Employee</th>
                <th className="px-4 py-2 text-left font-medium">Expires</th>
                <th className="px-4 py-2 text-left font-medium">Document type</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {documents.map((doc) => {
                const displayName = doc.preferredName
                  ? `${doc.preferredName} ${doc.lastName}`
                  : `${doc.firstName} ${doc.lastName}`;

                return (
                  <tr key={doc.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/admin/employees/${doc.employeeId}?tab=personal`}
                        className="font-medium hover:underline"
                      >
                        {displayName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "text-xs font-medium",
                          doc.expiryStatus === "expired"
                            ? "text-red-600"
                            : "text-amber-700"
                        )}
                      >
                        {formatShortDate(doc.expiryDate)}
                        {doc.expiryStatus === "expired" ? " · Expired" : ""}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {ID_DOC_TYPE_LABELS[doc.docType]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardPanel>
  );
}
