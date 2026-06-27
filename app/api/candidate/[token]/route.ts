import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const offer = await prisma.jobOffer.findUnique({
      where: { token },
      select: {
        id: true,
        candidateFirst: true,
        candidateLast: true,
        candidateEmail: true,
        candidatePhone: true,
        jobTitle: true,
        payType: true,
        payRate: true,
        payFrequency: true,
        startDate: true,
        workType: true,
        notes: true,
        status: true,
        intake: { select: { id: true, submittedAt: true } },
      },
    });

    if (!offer) return apiError("Not found", "Offer not found or link is invalid", 404);

    // Mark as VIEWED on first open (only from SENT)
    if (offer.status === "SENT") {
      await prisma.jobOffer.update({
        where: { token },
        data: { status: "VIEWED", viewedAt: new Date() },
      });
    }

    return Response.json(apiSuccess({ ...offer, status: offer.status === "SENT" ? "VIEWED" : offer.status }));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    return apiError("Failed", msg, 500);
  }
}
