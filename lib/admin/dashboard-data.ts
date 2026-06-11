import { unstable_noStore as noStore } from "next/cache";
import {
  endOfMonth,
  format,
  startOfMonth,
} from "date-fns";
import { prisma, hasOffboardingModels } from "@/lib/prisma";
import { getWriteUpAcknowledgedAt } from "@/lib/writeups/constants";
import { countImportantDatesTodayOrTomorrow } from "@/lib/admin/important-dates";
import {
  countExpiringIdentityDocuments,
  getExpiringIdentityDocuments,
} from "@/lib/identity-documents/service";

const EXPIRING_DOCUMENTS_WITHIN_DAYS = 30;

/** Prisma filter matching unacknowledged write-ups (same rule as employee write-ups API) */
const unacknowledgedWriteUpWhere = {
  acknowledgedAt: null,
  employeeSignedAt: null,
} as const;

export type AdminDashboardData = Awaited<ReturnType<typeof fetchAdminDashboardData>>;

/** Load in-progress offboarding instances for the dashboard card */
async function fetchOffboardingInProgressRaw() {
  if (!hasOffboardingModels()) {
    return [];
  }

  return prisma.offboardingInstance.findMany({
    where: { status: "IN_PROGRESS" },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
}

/** Load all admin dashboard metrics and list data in parallel */
export async function fetchAdminDashboardData(viewMonth: Date) {
  noStore();
  const today = new Date();
  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);

  const [
    totalEmployees,
    activeEmployees,
    onLeaveToday,
    onLeaveTodayRequests,
    pendingLeaveCount,
    pendingWriteUpsCount,
    unsignedDocsCount,
    oldestUnsigned,
    expiringDocumentsRaw,
    expiringDocumentsCount,
    onboardingInProgressRaw,
    pendingLeaveRequests,
    recentWriteUps,
    leaveThisMonth,
    unsignedAssignments,
    nearTermImportantDatesCount,
    offboardingInProgressRaw,
  ] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.leaveRequest.count({
      where: {
        status: "APPROVED",
        startDate: { lte: today },
        endDate: { gte: today },
      },
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        startDate: { lte: today },
        endDate: { gte: today },
      },
      select: { endDate: true },
      orderBy: { endDate: "asc" },
      take: 1,
    }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.writeUp.count({ where: unacknowledgedWriteUpWhere }),
    prisma.documentAssignment.count({
      where: {
        sentAt: { not: null },
        signedAt: null,
        hrApprovedAt: null,
      },
    }),
    prisma.documentAssignment.findFirst({
      where: { sentAt: { not: null }, signedAt: null },
      orderBy: { assignedAt: "asc" },
      select: { assignedAt: true },
    }),
    getExpiringIdentityDocuments(EXPIRING_DOCUMENTS_WITHIN_DAYS, 5),
    countExpiringIdentityDocuments(EXPIRING_DOCUMENTS_WITHIN_DAYS),
    prisma.onboardingInstance.findMany({
      where: { status: "IN_PROGRESS" },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
          },
        },
        stepProgress: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.leaveRequest.findMany({
      where: { status: "PENDING" },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        leaveType: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
    prisma.writeUp.findMany({
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: { in: ["APPROVED", "PENDING"] },
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        leaveType: { select: { name: true } },
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.documentAssignment.findMany({
      where: {
        sentAt: { not: null },
        signedAt: null,
        hrApprovedAt: null,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        sop: { select: { title: true } },
      },
      orderBy: { assignedAt: "asc" },
      take: 5,
    }),
    countImportantDatesTodayOrTomorrow(),
    fetchOffboardingInProgressRaw(),
  ]);

  const inactiveEmployees = totalEmployees - activeEmployees;
  const pendingApprovalsTotal = pendingLeaveCount + pendingWriteUpsCount;
  const attentionCount = pendingLeaveCount + pendingWriteUpsCount;
  const earliestReturn = onLeaveTodayRequests[0]?.endDate ?? null;

  return {
    kpis: {
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      onLeaveToday,
      earliestReturn,
      pendingApprovalsTotal,
      pendingLeaveCount,
      pendingWriteUpsCount,
      unsignedDocsCount,
      oldestUnsignedAssignedAt: oldestUnsigned?.assignedAt ?? null,
    },
    attentionCount,
    nearTermImportantDatesCount,
    offboardingInProgress: await Promise.all(
      offboardingInProgressRaw.map(async (instance) => {
        const pendingDocs = await prisma.documentAssignment.count({
          where: {
            employeeId: instance.employeeId,
            isOffboarding: true,
            offboardingSentAt: { not: null },
            signedAt: null,
            hrApprovedAt: null,
          },
        });
        return {
          id: instance.id,
          employeeId: instance.employee.id,
          firstName: instance.employee.firstName,
          lastName: instance.employee.lastName,
          lastDayDate: instance.lastDayDate,
          pendingDocs,
        };
      })
    ),
    expiringDocuments: expiringDocumentsRaw.map((doc) => ({
      id: doc.id,
      employeeId: doc.employeeId,
      firstName: doc.firstName,
      lastName: doc.lastName,
      preferredName: doc.preferredName,
      docType: doc.docType,
      expiryDate: doc.expiryDate,
      expiryStatus: doc.expiryStatus,
    })),
    expiringDocumentsCount,
    onboardingInProgress: onboardingInProgressRaw.map((instance) => {
      const totalSteps = instance.stepProgress.length;
      const completedSteps = instance.stepProgress.filter(
        (step) => step.status === "COMPLETED"
      ).length;
      const percent =
        totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

      return {
        id: instance.id,
        employeeId: instance.employee.id,
        firstName: instance.employee.firstName,
        lastName: instance.employee.lastName,
        jobTitle: instance.employee.jobTitle,
        completedSteps,
        totalSteps,
        percent,
      };
    }),
    pendingLeaveRequests: pendingLeaveRequests.map((request) => ({
      id: request.id,
      employeeId: request.employee.id,
      firstName: request.employee.firstName,
      lastName: request.employee.lastName,
      policyName: request.leaveType.name,
      startDate: request.startDate,
      endDate: request.endDate,
      workingDays: request.workingDays,
    })),
    pendingLeaveTotal: pendingLeaveCount,
    recentWriteUps: recentWriteUps.map((writeUp) => ({
      id: writeUp.id,
      employeeId: writeUp.employee.id,
      firstName: writeUp.employee.firstName,
      lastName: writeUp.employee.lastName,
      category: writeUp.category,
      date: writeUp.date,
      acknowledgedAt: getWriteUpAcknowledgedAt(writeUp),
    })),
    unacknowledgedWriteUpsCount: pendingWriteUpsCount,
    unsignedAssignments: unsignedAssignments.map((assignment) => ({
      id: assignment.id,
      employeeId: assignment.employee.id,
      firstName: assignment.employee.firstName,
      lastName: assignment.employee.lastName,
      title: assignment.sop.title,
      assignedAt: assignment.assignedAt,
    })),
    leaveThisMonth: leaveThisMonth.map((request) => ({
      id: request.id,
      employeeId: request.employee.id,
      firstName: request.employee.firstName,
      lastName: request.employee.lastName,
      leaveTypeName: request.leaveType.name,
      startDate: request.startDate,
      endDate: request.endDate,
      workingDays: request.workingDays,
      status: request.status as "APPROVED" | "PENDING",
    })),
    viewMonth: format(viewMonth, "yyyy-MM"),
    viewMonthLabel: format(viewMonth, "MMMM yyyy"),
  };
}
