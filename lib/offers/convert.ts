import { prisma } from "@/lib/prisma";
import { createEmployee } from "@/lib/employees";
import type { EmployeeFormValues } from "@/lib/validations";

export type ConvertOfferInput = {
  offerId: string;
  workEmail: string;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT";
  scheduleType: "FIXED" | "SHIFT_BASED" | "HOURS_BASED" | "FLEXIBLE";
  scheduleConfig: EmployeeFormValues["scheduleConfig"];
  assignedByUserId: string;
};

/** Convert a completed job offer intake into a new Employee account */
export async function convertOfferToEmployee(input: ConvertOfferInput) {
  const offer = await prisma.jobOffer.findUnique({
    where: { id: input.offerId },
    include: { intake: true },
  });

  if (!offer) throw new Error("Job offer not found");
  if (offer.status !== "INTAKE_COMPLETE") {
    throw new Error("Intake form has not been completed yet");
  }
  if (offer.employeeId) throw new Error("This offer has already been converted");

  const intake = offer.intake;

  const employeeInput: EmployeeFormValues = {
    firstName: offer.candidateFirst,
    lastName: offer.candidateLast,
    workEmail: input.workEmail,
    phone: intake?.phone ?? "",
    jobTitle: offer.jobTitle,
    departmentId: offer.departmentId ?? "",
    positionId: offer.positionId ?? undefined,
    employmentType: input.employmentType,
    payType: offer.payType,
    payRate: offer.payRate ?? undefined,
    payFrequency: offer.payFrequency ?? undefined,
    startDate: offer.startDate.toISOString().split("T")[0],
    scheduleType: input.scheduleType,
    scheduleConfig: input.scheduleConfig,
    personalEmail: intake?.personalEmail ?? offer.candidateEmail,
    addressStreet: intake?.addressStreet ?? undefined,
    addressCity: intake?.addressCity ?? undefined,
    addressState: intake?.addressState ?? undefined,
    addressZip: intake?.addressZip ?? undefined,
    addressCountry: intake?.addressCountry ?? undefined,
    emergencyContactName: intake?.emergencyContactName ?? "",
    emergencyContactPhone: intake?.emergencyContactPhone ?? "",
    emergencyContactRelation: intake?.emergencyContactRelation ?? "",
    birthdate: intake?.birthdate
      ? intake.birthdate.toISOString().split("T")[0]
      : undefined,
    tShirtSize: (intake?.tShirtSize as EmployeeFormValues["tShirtSize"]) ?? undefined,
    allergies: intake?.allergies ?? undefined,
    isNonExempt: true,
  };

  const employee = await createEmployee(employeeInput, input.assignedByUserId);

  await prisma.jobOffer.update({
    where: { id: offer.id },
    data: {
      status: "CONVERTED",
      convertedAt: new Date(),
      employeeId: employee.id,
    },
  });

  return employee;
}
