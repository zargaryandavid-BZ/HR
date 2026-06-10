import { prisma } from "@/lib/prisma";
import { isDocumentHrConfirmed } from "@/lib/individual-settings/constants";
import { getEmployeeDocumentsWithStatus } from "@/lib/individual-settings/documents";

export type DateUrgency = "overdue" | "urgent" | "warning" | "upcoming";

export type ImportantDateItem = {
  type: string;
  label: string;
  date: string;
  daysUntil: number;
  urgency: DateUrgency;
};

function urgency(daysUntil: number): DateUrgency {
  if (daysUntil < 0) return "overdue";
  if (daysUntil <= 7) return "urgent";
  if (daysUntil <= 30) return "warning";
  return "upcoming";
}

function diffDays(target: Date, now: Date): number {
  const ms = target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
  return Math.round(ms / 86_400_000);
}

/** Build the important dates list for a given employee */
export async function getImportantDates(employeeId: string): Promise<ImportantDateItem[]> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      startDate: true,
      contractEndDate: true,
      probationEndDate: true,
      nextReviewDate: true,
      benefitsEnrollmentDeadline: true,
    },
  });

  if (!employee) return [];

  const now = new Date();
  const items: ImportantDateItem[] = [];

  function add(type: string, label: string, date: Date | null | undefined) {
    if (!date) return;
    const d = diffDays(new Date(date), new Date(now));
    items.push({ type, label, date: date.toISOString().split("T")[0], daysUntil: d, urgency: urgency(d) });
  }

  // Static employee dates
  add("contract_end", "Contract ends", employee.contractEndDate);
  add("probation_end", "Probation ends", employee.probationEndDate);
  add("performance_review", "Performance review", employee.nextReviewDate);
  add("benefits_enrollment", "Benefits enrollment", employee.benefitsEnrollmentDeadline);

  // Work anniversary — find the next upcoming one
  if (employee.startDate) {
    const start = new Date(employee.startDate);
    const thisYear = now.getFullYear();
    const candidate = new Date(thisYear, start.getMonth(), start.getDate());
    const anniversary = candidate < now
      ? new Date(thisYear + 1, start.getMonth(), start.getDate())
      : candidate;
    add("anniversary", "Work anniversary", anniversary);
  }

  // Onboarding documents awaiting HR confirmation
  const employeeDocs = await getEmployeeDocumentsWithStatus(employeeId, { sentOnly: true });
  const unconfirmedDocs = [...employeeDocs.companyWide, ...employeeDocs.assigned].filter(
    (doc) => !isDocumentHrConfirmed(doc.status)
  );

  if (unconfirmedDocs.length > 0) {
    const earliestAssignment = await prisma.documentAssignment.findFirst({
      where: {
        employeeId,
        sopId: { in: unconfirmedDocs.map((doc) => doc.id) },
        hrApprovedAt: null,
      },
      orderBy: { assignedAt: "asc" },
      select: { assignedAt: true },
    });

    const baseDate = earliestAssignment?.assignedAt ?? now;
    const deadline = new Date(baseDate);
    deadline.setDate(deadline.getDate() + 7);
    add("document_deadline", "Documents due", deadline);
  }

  return items.sort((a, b) => a.daysUntil - b.daysUntil);
}
