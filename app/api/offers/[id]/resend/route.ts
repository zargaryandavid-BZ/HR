import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { sendOfferEmail } from "@/lib/offers/email";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const { id } = await params;

    const offer = await prisma.jobOffer.findUnique({ where: { id } });
    if (!offer) return apiError("Not found", "Offer not found", 404);

    if (offer.status === "CONVERTED") {
      return apiError("Forbidden", "Cannot resend a converted offer");
    }

    const emailResult = await sendOfferEmail({
      candidateFirst: offer.candidateFirst,
      candidateLast: offer.candidateLast,
      candidateEmail: offer.candidateEmail,
      jobTitle: offer.jobTitle,
      payType: offer.payType,
      payRate: offer.payRate,
      payFrequency: offer.payFrequency,
      startDate: offer.startDate,
      workType: offer.workType,
      token: offer.token,
    });

    if (!emailResult.ok) {
      return apiError("Email failed", emailResult.reason, 500);
    }

    const updated = await prisma.jobOffer.update({
      where: { id },
      data: {
        status: offer.status === "DRAFT" ? "SENT" : offer.status,
        sentAt: new Date(),
      },
    });

    return Response.json(apiSuccess(updated, "Offer resent"));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    return apiError("Failed", msg, 500);
  }
}
