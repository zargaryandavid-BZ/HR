import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getEmployeeSession } from "@/lib/employee-session";

/** Returns the current employee's profile (self only) */
export async function GET() {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const employee = await prisma.employee.findUnique({
      where: { id: session.employeeId },
      include: {
        department: { select: { name: true } },
        position: { select: { name: true } },
        manager: { select: { firstName: true, lastName: true } },
      },
    });

    if (!employee) return apiError("Unauthorized", "Employee session invalid", 401);

    return Response.json(
      apiSuccess({
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        preferredName: employee.preferredName,
        // Contact
        phone: employee.phone,
        personalEmail: employee.personalEmail,
        workEmail: employee.workEmail,
        // Address
        addressStreet: employee.addressStreet,
        addressCity: employee.addressCity,
        addressState: employee.addressState,
        addressZip: employee.addressZip,
        // Personal
        birthdate: employee.birthdate?.toISOString() ?? null,
        // Employment
        jobTitle: employee.jobTitle,
        employmentType: employee.employmentType,
        startDate: employee.startDate?.toISOString() ?? null,
        department: employee.department ? { name: employee.department.name } : null,
        position: employee.position ? { name: employee.position.name } : null,
        manager: employee.manager
          ? { firstName: employee.manager.firstName, lastName: employee.manager.lastName }
          : null,
        // Compensation
        payType: employee.payType,
        payRate: employee.payRate,
        payFrequency: employee.payFrequency,
        isNonExempt: employee.isNonExempt,
        overtimeEligible: employee.overtimeEligible,
        compensationEffectiveDate: employee.compensationEffectiveDate?.toISOString() ?? null,
        // Emergency contact
        emergencyContactName: employee.emergencyContactName,
        emergencyContactRelation: employee.emergencyContactRelation,
        emergencyContactPhone: employee.emergencyContactPhone,
        // Preferences
        tshirtSize: employee.tShirtSize,
        allergyInfo: employee.allergies,
        // QR
        qrCodeToken: employee.qrCodeToken,
      })
    );
  } catch {
    return apiError("Server error", "Failed to fetch employee", 500);
  }
}
