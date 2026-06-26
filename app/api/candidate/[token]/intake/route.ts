import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

const intakeSchema = z.object({
  phone: z.string().optional(),
  personalEmail: z.string().email().optional().or(z.literal("")),
  birthdate: z.string().optional(),
  addressStreet: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressZip: z.string().optional(),
  addressCountry: z.string().optional(),
  emergencyContactName: z.string().min(1, "Emergency contact name is required"),
  emergencyContactPhone: z.string().min(1, "Emergency contact phone is required"),
  emergencyContactRelation: z.string().min(1, "Relationship is required"),
  emergencyContactConsent: z.boolean(),
  tShirtSize: z.string().optional(),
  allergies: z.string().optional(),
  idFileUrl: z.string().optional(),
  idFileName: z.string().optional(),
});

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
    const parsed = intakeSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const data = parsed.data;

    await prisma.$transaction([
      prisma.candidateIntakeResponse.create({
        data: {
          jobOfferId: offer.id,
          phone: data.phone || null,
          personalEmail: data.personalEmail || null,
          birthdate: data.birthdate ? new Date(data.birthdate) : null,
          addressStreet: data.addressStreet || null,
          addressCity: data.addressCity || null,
          addressState: data.addressState || null,
          addressZip: data.addressZip || null,
          addressCountry: data.addressCountry || null,
          emergencyContactName: data.emergencyContactName,
          emergencyContactPhone: data.emergencyContactPhone,
          emergencyContactRelation: data.emergencyContactRelation,
          emergencyContactConsent: data.emergencyContactConsent,
          tShirtSize: data.tShirtSize || null,
          allergies: data.allergies || null,
          idFileUrl: data.idFileUrl || null,
          idFileName: data.idFileName || null,
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
