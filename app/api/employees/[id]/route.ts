import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { employeeFormPatchSchema } from "@/lib/validations";
import {
  buildAddressBirthdateData,
  sanitizeEmployeeResponse,
} from "@/lib/employees/personal-info";
import { logIndividualSettingsAudit } from "@/lib/individual-settings/audit";
import { isOnboardingInProgress } from "@/lib/onboarding/instance-status";

type RouteParams = { params: Promise<{ id: string }> };

/** Get a single employee by ID */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return apiError("Unauthorized", "Not authenticated", 401);
    }
    if (!["HR_ADMIN", "SUPER_ADMIN", "MANAGER"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id } = await params;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        position: {
          include: {
            onboardingTemplates: {
              where: { isActive: true },
              select: {
                id: true,
                name: true,
                _count: { select: { steps: true } },
              },
            },
          },
        },
        manager: { select: { id: true, firstName: true, lastName: true } },
        user: { select: { id: true, email: true, role: true } },
        onboardingInstances: {
          where: { status: { in: ["NOT_STARTED", "IN_PROGRESS"] } },
          include: {
            template: {
              include: {
                position: true,
                _count: { select: { steps: true } },
              },
            },
            stepProgress: {
              select: {
                status: true,
                step: { select: { stepType: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!employee) {
      return apiError("Not found", "Employee not found", 404);
    }

    const activeOnboarding = employee.onboardingInstances.filter((instance) =>
      isOnboardingInProgress(instance, { excludeDocumentSign: true })
    );

    return Response.json(
      apiSuccess(
        sanitizeEmployeeResponse(
          { ...employee, onboardingInstances: activeOnboarding.slice(0, 1) },
          session.role
        )
      )
    );
  } catch {
    return apiError("Server error", "Failed to fetch employee", 500);
  }
}

/** Update an employee's profile and schedule */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return apiError("Unauthorized", "Not authenticated", 401);
    }
    if (!["HR_ADMIN", "SUPER_ADMIN"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { id } = await params;
    const body = await request.json();

    const parsed = employeeFormPatchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const data = parsed.data;
    const personalData = buildAddressBirthdateData(data);

    // Read current compensation before update to detect changes
    const currentEmployee = await prisma.employee.findUnique({
      where: { id },
      select: { payRate: true, payType: true },
    });
    if (!currentEmployee) return apiError("Not found", "Employee not found", 404);

    const isCompensationChange =
      data.payRate !== undefined && data.payRate !== (currentEmployee.payRate ?? undefined);

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.preferredName !== undefined && { preferredName: data.preferredName || null }),
        ...(data.personalEmail !== undefined && { personalEmail: data.personalEmail || null }),
        ...(data.workEmail !== undefined && { workEmail: data.workEmail }),
        ...(data.phone !== undefined && { phone: data.phone || null }),
        ...(data.departmentId !== undefined && { departmentId: data.departmentId }),
        ...(data.positionId !== undefined && { positionId: data.positionId || null }),
        ...(data.jobTitle !== undefined && { jobTitle: data.jobTitle }),
        ...(data.employmentType !== undefined && { employmentType: data.employmentType }),
        ...(data.managerId !== undefined && { managerId: data.managerId || null }),
        ...(data.payType !== undefined && { payType: data.payType }),
        ...(data.isNonExempt !== undefined && {
          isNonExempt: data.isNonExempt,
          overtimeEligible: data.isNonExempt,
        }),
        ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
        ...(data.scheduleType !== undefined && { scheduleType: data.scheduleType }),
        ...(data.scheduleConfig !== undefined && { scheduleConfig: data.scheduleConfig }),
        ...(data.mealBreak1WaiverEnabled !== undefined && {
          mealBreak1WaiverEnabled: data.mealBreak1WaiverEnabled,
        }),
        ...(data.mealBreak2WaiverEnabled !== undefined && {
          mealBreak2WaiverEnabled: data.mealBreak2WaiverEnabled,
        }),
        ...(data.emergencyContactName !== undefined && {
          emergencyContactName: data.emergencyContactName || null,
        }),
        ...(data.emergencyContactPhone !== undefined && {
          emergencyContactPhone: data.emergencyContactPhone || null,
        }),
        ...(data.emergencyContactRelation !== undefined && {
          emergencyContactRelation: data.emergencyContactRelation || null,
        }),
        // Compensation fields
        ...(data.payRate !== undefined && { payRate: data.payRate }),
        ...(data.payFrequency !== undefined && { payFrequency: data.payFrequency }),
        ...(data.compensationEffectiveDate !== undefined && {
          compensationEffectiveDate: data.compensationEffectiveDate
            ? new Date(data.compensationEffectiveDate)
            : null,
        }),
        ...personalData,
      },
      include: {
        department: true,
        manager: { select: { id: true, firstName: true, lastName: true } },
        user: { select: { id: true, email: true, role: true } },
      },
    });

    // Record compensation history when pay rate changes
    if (isCompensationChange && data.payRate !== undefined) {
      const effectiveDate = data.compensationEffectiveDate
        ? new Date(data.compensationEffectiveDate)
        : new Date();

      await prisma.compensationHistory.create({
        data: {
          employeeId: id,
          previousRate: currentEmployee.payRate ?? null,
          newRate: data.payRate,
          payType: data.payType ?? currentEmployee.payType,
          effectiveDate,
          changedBy: session.id,
        },
      });

      await logIndividualSettingsAudit({
        userId: session.id,
        action: "COMPENSATION_UPDATED",
        targetId: id,
        targetTable: "Employee",
        oldValue: { payRate: currentEmployee.payRate },
        newValue: {
          employeeId: id,
          previousRate: currentEmployee.payRate,
          newRate: data.payRate,
          payFrequency: data.payFrequency,
          effectiveDate: effectiveDate.toISOString(),
          performedBy: session.id,
        },
      });
    }

    return Response.json(
      apiSuccess(sanitizeEmployeeResponse(employee, session.role), "Employee updated successfully")
    );
  } catch {
    return apiError("Server error", "Failed to update employee", 500);
  }
}
