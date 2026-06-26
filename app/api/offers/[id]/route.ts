import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { sendOfferEmail } from "@/lib/offers/email";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { id } = await params;

    const offer = await prisma.jobOffer.findUnique({
      where: { id },
      include: { intake: true },
    });

    if (!offer) return apiError("Not found", "Offer not found", 404);
    return Response.json(apiSuccess(offer));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    return apiError("Failed", msg, 500);
  }
}

const updateOfferSchema = z.object({
  candidateFirst: z.string().min(1).optional(),
  candidateLast: z.string().min(1).optional(),
  candidateEmail: z.string().email().optional(),
  jobTitle: z.string().min(1).optional(),
  positionId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  payType: z.enum(["HOURLY", "SALARY"]).optional(),
  payRate: z.number().positive().nullable().optional(),
  payFrequency: z.enum(["WEEKLY", "BIWEEKLY", "SEMI_MONTHLY", "MONTHLY"]).nullable().optional(),
  startDate: z.string().optional(),
  workType: z.enum(["REMOTE", "ONSITE", "HYBRID"]).optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { id } = await params;

    const offer = await prisma.jobOffer.findUnique({ where: { id } });
    if (!offer) return apiError("Not found", "Offer not found", 404);

    if (!["DRAFT", "SENT"].includes(offer.status)) {
      return apiError("Forbidden", "Cannot edit an offer that has been viewed or responded to");
    }

    const body = await request.json();
    const parsed = updateOfferSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const updated = await prisma.jobOffer.update({
      where: { id },
      data: {
        candidateFirst: parsed.data.candidateFirst,
        candidateLast: parsed.data.candidateLast,
        candidateEmail: parsed.data.candidateEmail,
        jobTitle: parsed.data.jobTitle,
        positionId: parsed.data.positionId,
        departmentId: parsed.data.departmentId,
        payType: parsed.data.payType,
        payRate: parsed.data.payRate,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
        workType: parsed.data.workType,
        notes: parsed.data.notes,
      },
    });

    return Response.json(apiSuccess(updated, "Offer updated"));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    return apiError("Failed", msg, 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { id } = await params;

    const offer = await prisma.jobOffer.findUnique({ where: { id } });
    if (!offer) return apiError("Not found", "Offer not found", 404);

    if (offer.status !== "DRAFT") {
      return apiError("Forbidden", "Only draft offers can be deleted");
    }

    await prisma.jobOffer.delete({ where: { id } });
    return Response.json(apiSuccess(null, "Offer deleted"));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    return apiError("Failed", msg, 500);
  }
}
