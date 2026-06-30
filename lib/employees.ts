import { randomUUID } from "crypto";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/app-url";
import { sendWelcomeEmail } from "@/lib/instantly";
import { sendSms } from "@/lib/twilio";
import type { EmployeeFormValues } from "@/lib/validations";
import { buildAddressBirthdateData } from "@/lib/employees/personal-info";
import { generateEmployeeNumber } from "@/lib/employees/employee-number";
import { createLeaveBalancesForEmployee } from "@/lib/leave/balances";
import { seedCompanyWideDocumentAssignments, seedAutomationDocumentAssignments } from "@/lib/documents/assignments";

/** Generate a secure temporary password for new accounts */
function generateTempPassword(): string {
  return randomUUID().slice(0, 12) + "A1!";
}

type CreateEmployeeInput = EmployeeFormValues & {
  role?: Role;
};

/** Create a new employee with linked user account, QR token, and welcome notifications */
export async function createEmployee(
  input: CreateEmployeeInput,
  assignedByUserId: string
) {
  const tempPassword = generateTempPassword();
  const qrCodeToken = randomUUID();
  const fullName = `${input.firstName} ${input.lastName}`;

  const scheduleConfig = input.scheduleConfig as Prisma.InputJsonValue;
  const personalData = buildAddressBirthdateData(input);

  const employeeNumber = await generateEmployeeNumber();

  const employee = await prisma.$transaction(async (tx) => {
    const [existingEmployeeEmail, existingUserEmail] = await Promise.all([
      tx.employee.findUnique({
        where: { workEmail: input.workEmail },
        select: { id: true },
      }),
      tx.user.findUnique({
        where: { email: input.workEmail },
        select: { id: true },
      }),
    ]);

    if (existingEmployeeEmail || existingUserEmail) {
      throw new Error("Work email is already in use. Please use a different email.");
    }

    const newEmployee = await tx.employee.create({
      data: {
        employeeNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        preferredName: input.preferredName || null,
        personalEmail: input.personalEmail || null,
        workEmail: input.workEmail,
        phone: input.phone || null,
        departmentId: input.departmentId?.trim() || null,
        positionId: input.positionId || null,
        jobTitle: input.jobTitle,
        employmentType: input.employmentType,
        managerId: input.managerId || null,
        payType: input.payType,
        isNonExempt: input.isNonExempt ?? true,
        overtimeEligible: input.isNonExempt ?? true,
        startDate: new Date(input.startDate),
        qrCodeToken,
        scheduleType: input.scheduleType,
        scheduleConfig,
        emergencyContactName: input.emergencyContactName || null,
        emergencyContactPhone: input.emergencyContactPhone || null,
        emergencyContactRelation: input.emergencyContactRelation || null,
        ...personalData,
      },
      include: { department: true },
    });

    await tx.user.create({
      data: {
        email: input.workEmail,
        name: fullName,
        role: input.role ?? "EMPLOYEE",
        employeeId: newEmployee.id,
        mustChangePassword: true,
      },
    });

    await createLeaveBalancesForEmployee(newEmployee.id, new Date().getFullYear(), tx);
    await seedCompanyWideDocumentAssignments(newEmployee.id, assignedByUserId, tx);
    if (newEmployee.positionId) {
      await seedAutomationDocumentAssignments(
        newEmployee.id,
        newEmployee.positionId,
        assignedByUserId,
        tx
      );
    }

    return newEmployee;
  });

  const supabase = createAdminClient();
  const { error: authError } = await supabase.auth.admin.createUser({
    email: input.workEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name: fullName },
  });

  if (authError) {
    console.error("Supabase user creation error:", authError);
  }

  await sendWelcomeEmail(input.workEmail, fullName, tempPassword);

  if (input.phone) {
    const appUrl = getAppUrl();
    await sendSms(
      input.phone,
      `Welcome to Bazaar Printing HR! Log in at ${appUrl}/login with ${input.workEmail}. Check your email for your temporary password.`
    );
  }

  return employee;
}

/** Build Prisma where clause for employee list filters */
export function buildEmployeeWhereClause(params: {
  search?: string;
  departmentId?: string;
  status?: string;
}) {
  const where: Prisma.EmployeeWhereInput = {};

  if (params.search) {
    where.OR = [
      { firstName: { contains: params.search, mode: "insensitive" } },
      { lastName: { contains: params.search, mode: "insensitive" } },
      { workEmail: { contains: params.search, mode: "insensitive" } },
      { preferredName: { contains: params.search, mode: "insensitive" } },
    ];
  }

  if (params.departmentId) {
    where.departmentId = params.departmentId;
  }

  if (params.status === "ACTIVE" || params.status === "INACTIVE") {
    where.status = params.status;
  }

  return where;
}
