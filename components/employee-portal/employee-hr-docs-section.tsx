"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeDashboardSection } from "./employee-dashboard-section";

type HrDoc = {
  id: string;
  type: "OFFER_LETTER" | "WELCOME_EMAIL";
  fileUrl: string;
  generatedAt: string;
};

const DOC_META: Record<string, { label: string; subtitle: string }> = {
  OFFER_LETTER: { label: "Offer Letter", subtitle: "Sent by HR" },
  WELCOME_EMAIL: { label: "Welcome Email", subtitle: "Sent to employee" },
};

/**
 * Section 3 — HR Documents.
 * Shows only HR-generated documents (Offer Letter, Welcome Email, etc.).
 * Onboarding documents with signing/approval status live in the Onboarding section.
 */
export function EmployeeHrDocsSection({ employeeId }: { employeeId?: string }) {
  const { data: docs, isLoading } = useQuery<HrDoc[]>({
    queryKey: ["employee-hr-docs", employeeId],
    queryFn: async () => {
      const url = employeeId
        ? `/api/employees/${employeeId}/documents/generated`
        : "/api/employee/hr-documents";
      const res = await fetch(url);
      const json = await res.json();
      return json.data ?? [];
    },
  });

  if (isLoading) return <Skeleton className="h-28 w-full" />;

  return (
    <EmployeeDashboardSection title="HR Documents">
      {!docs?.length ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No HR documents generated yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="pb-2 text-left font-medium">Document</th>
                <th className="pb-2 text-left font-medium w-[120px]">Date</th>
                <th className="pb-2 text-right font-medium w-[120px]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {docs.map((doc) => {
                const meta = DOC_META[doc.type] ?? { label: doc.type, subtitle: "HR document" };
                return (
                  <tr key={doc.id}>
                    <td className="py-3">
                      <p className="font-medium">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">{meta.subtitle}</p>
                    </td>
                    <td className="py-3 text-xs text-muted-foreground">
                      {format(new Date(doc.generatedAt), "MMM d, yyyy")}
                    </td>
                    <td className="py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 w-[110px] justify-center"
                        asChild
                      >
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                          {doc.type === "OFFER_LETTER" ? (
                            <><Download className="h-3.5 w-3.5 mr-1" />Download</>
                          ) : (
                            <><ExternalLink className="h-3.5 w-3.5 mr-1" />View</>
                          )}
                        </a>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </EmployeeDashboardSection>
  );
}
