import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { candidateIntakeSchema, normalizeCandidateIntake } from "@/lib/candidate/intake-validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const offer = await prisma.jobOffer.findUnique({
      where: { token },
      include: { intake: true },
    });

    if (!offer) return apiError("Not found", "Offer not found", 404);

    if (offer.status !== "APPROVED") {
      return apiError("Invalid", "You must accept the offer before completing the intake form");
    }

    if (offer.intake) {
      return apiError("Conflict", "Intake form has already been submitted", 409);
    }

    const body = await request.json();
    const parsed = candidateIntakeSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const data = normalizeCandidateIntake(parsed.data);

    if (data.idFileUrl && !data.idFileUrl.includes(`/candidate-intake/${offer.id}/`)) {
      return apiError("Validation failed", "Uploaded file does not belong to this offer");
    }

    await prisma.$transaction([
      prisma.candidateIntakeResponse.create({
        data: {
          jobOfferId: offer.id,
          phone: data.phone,
          personalEmail: data.personalEmail,
          birthdate: data.birthdate,
          addressStreet: data.addressStreet,
          addressCity: data.addressCity,
          addressState: data.addressState,
          addressZip: data.addressZip,
          addressCountry: data.addressCountry,
          emergencyContactName: data.emergencyContactName,
          emergencyContactPhone: data.emergencyContactPhone,
          emergencyContactRelation: data.emergencyContactRelation,
          emergencyContactConsent: data.emergencyContactConsent,
          tShirtSize: data.tShirtSize,
          allergies: data.allergies,
          idFileUrl: data.idFileUrl,
          idFileName: data.idFileName,
        },
      }),
      prisma.jobOffer.update({
        where: { id: offer.id },
        data: { status: "INTAKE_COMPLETE" },
      }),
    ]);

    return Response.json(apiSuccess(null, "Intake submitted successfully"), { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    return apiError("Failed", msg, 500);
  }
}
