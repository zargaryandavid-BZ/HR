import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const offer = await prisma.jobOffer.findUnique({ where: { token } });
    if (!offer) return apiError("Not found", "Offer not found", 404);

    if (!["SENT", "VIEWED"].includes(offer.status)) {
      return apiError("Invalid", "This offer has already been responded to");
    }

    await prisma.jobOffer.update({
      where: { token },
      data: { status: "DECLINED", declinedAt: new Date() },
    });

    return Response.json(apiSuccess(null, "Offer declined"));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    return apiError("Failed", msg, 500);
  }
}
