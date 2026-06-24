"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { formatDisplayDate } from "@/lib/dates";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { EmployeeDashboardSection } from "./employee-dashboard-section";
import {
  WriteUpAcknowledgeModal,
  type WriteUpAcknowledgeTarget,
} from "./writeup-acknowledge-modal";

type WriteUp = {
  id: string;
  number: number;
  category: string;
  date: string;
  description: string;
  consequence: string | null;
  attachmentUrl: string | null;
  issuedByName: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
};

const CATEGORY_BADGE: Record<string, string> = {
  ATTENDANCE: "bg-amber-100 text-amber-800 border-amber-200",
  CONDUCT: "bg-red-100 text-red-800 border-red-200",
  PERFORMANCE: "bg-blue-100 text-blue-800 border-blue-200",
  SAFETY: "bg-orange-100 text-orange-800 border-orange-200",
  POLICY: "bg-gray-100 text-gray-800 border-gray-200",
  OTHER: "bg-purple-100 text-purple-800 border-purple-200",
};

const CATEGORY_LABEL: Record<string, string> = {
  ATTENDANCE: "Attendance",
  CONDUCT: "Conduct",
  PERFORMANCE: "Performance",
  SAFETY: "Safety",
  POLICY: "Policy",
  OTHER: "Other",
};

/** Section 2 — Write-Ups table with type-to-confirm acknowledgment modal */
export function EmployeeWriteUpsSection() {
  const queryClient = useQueryClient();
  const [selectedWriteUp, setSelectedWriteUp] = useState<WriteUp | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: writeUps, isLoading } = useQuery<WriteUp[]>({
    queryKey: ["employee-writeups"],
    queryFn: async () => {
      const res = await fetch("/api/employee/write-ups");
      const json = await res.json();
      return json.data ?? [];
    },
  });

  const totalCount = writeUps?.length ?? 0;
  const unacknowledgedCount = useMemo(
    () => (writeUps ?? []).filter((w) => !w.acknowledgedAt).length,
    [writeUps]
  );

  const openAcknowledgeModal = (writeUp: WriteUp) => {
    setSelectedWriteUp(writeUp);
    setModalOpen(true);
  };

  const handleAcknowledgeSuccess = (result: {
    acknowledgedAt: string;
    acknowledgedBy: string;
  }) => {
    if (!selectedWriteUp) return;

    queryClient.setQueryData<WriteUp[]>(["employee-writeups"], (current) =>
      (current ?? []).map((writeUp) =>
        writeUp.id === selectedWriteUp.id
          ? {
              ...writeUp,
              acknowledgedAt: result.acknowledgedAt,
              acknowledgedBy: result.acknowledgedBy,
            }
          : writeUp
      )
    );
    setSelectedWriteUp(null);
  };

  const modalTarget: WriteUpAcknowledgeTarget | null = selectedWriteUp
    ? {
        id: selectedWriteUp.id,
        number: selectedWriteUp.number,
        category: selectedWriteUp.category,
        categoryLabel: CATEGORY_LABEL[selectedWriteUp.category] ?? selectedWriteUp.category,
        date: selectedWriteUp.date,
        description: selectedWriteUp.description,
        consequence: selectedWriteUp.consequence,
        issuedByName: selectedWriteUp.issuedByName,
        attachmentUrl: selectedWriteUp.attachmentUrl,
      }
    : null;

  if (isLoading) return <Skeleton className="h-36 w-full" />;

  return (
    <>
      <EmployeeDashboardSection
        title={`Write-Ups (${totalCount})`}
        defaultOpen={false}
        actions={
          <>
            {unacknowledgedCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-0.5 text-xs font-medium">
                {unacknowledgedCount} pending
              </span>
            )}
            {unacknowledgedCount === 0 && totalCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                All acknowledged
              </span>
            )}
          </>
        }
      >
        {!writeUps?.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No write-ups on record.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="pb-2 text-left font-medium pr-4">Write-Up</th>
                  <th className="pb-2 text-left font-medium w-[100px]">Category</th>
                  <th className="pb-2 text-left font-medium w-[110px]">Date</th>
                  <th className="pb-2 text-right font-medium w-[160px]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {writeUps.map((w) => (
                  <tr key={w.id} className="align-top">
                    <td className="py-3 pr-4">
                      <p className="font-medium">
                        Write-up #{w.number} — {CATEGORY_LABEL[w.category] ?? w.category}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {w.description}
                      </p>
                      {w.attachmentUrl && (
                        <a
                          href={w.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline mt-0.5 inline-block"
                        >
                          View attachment
                        </a>
                      )}
                    </td>
                    <td className="py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                          CATEGORY_BADGE[w.category] ?? "bg-gray-100 text-gray-800"
                        )}
                      >
                        {CATEGORY_LABEL[w.category] ?? w.category}
                      </span>
                    </td>
                    <td className="py-3 text-xs text-muted-foreground">
                      {formatDisplayDate(w.date)}
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      {w.acknowledgedAt ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          Acknowledged{" "}
                          <span className="font-normal">
                            {formatDisplayDate(w.acknowledgedAt)}
                          </span>
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-amber-700 border-amber-300 hover:bg-amber-50 text-xs h-7"
                          onClick={() => openAcknowledgeModal(w)}
                        >
                          Acknowledge →
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </EmployeeDashboardSection>

      <WriteUpAcknowledgeModal
        writeUp={modalTarget}
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setSelectedWriteUp(null);
        }}
        onSuccess={handleAcknowledgeSuccess}
      />
    </>
  );
}
