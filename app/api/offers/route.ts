import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { sendOfferEmail } from "@/lib/offers/email";

const createOfferSchema = z.object({
  candidateFirst: z.string().min(1, "First name required"),
  candidateLast: z.string().min(1, "Last name required"),
  candidateEmail: z.string().email("Valid email required"),
  candidatePhone: z.string().optional(),
  jobTitle: z.string().min(1, "Job title required"),
  positionId: z.string().optional(),
  departmentId: z.string().optional(),
  payType: z.enum(["HOURLY", "SALARY"]),
  payRate: z.number().positive().optional(),
  payFrequency: z.enum(["WEEKLY", "BIWEEKLY", "SEMI_MONTHLY", "MONTHLY"]).optional(),
  startDate: z.string().min(1, "Start date required"),
  workType: z.enum(["REMOTE", "ONSITE", "HYBRID"]),
  notes: z.string().optional(),
  sendNow: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    void session;

    const offers = await prisma.jobOffer.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        intake: {
          select: { id: true, submittedAt: true },
        },
      },
    });

    return Response.json(apiSuccess(offers));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch offers";
    return apiError("Failed", msg, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const body = await request.json();
    const parsed = createOfferSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const { sendNow, ...data } = parsed.data;

    const offer = await prisma.jobOffer.create({
      data: {
        candidateFirst: data.candidateFirst,
        candidateLast: data.candidateLast,
        candidateEmail: data.candidateEmail,
        candidatePhone: data.candidatePhone ?? null,
        jobTitle: data.jobTitle,
        positionId: data.positionId ?? null,
        departmentId: data.departmentId ?? null,
        payType: data.payType,
        payRate: data.payRate ?? null,
        payFrequency: data.payFrequency ?? null,
        startDate: new Date(data.startDate),
        workType: data.workType,
        notes: data.notes ?? null,
        status: sendNow ? "SENT" : "DRAFT",
        sentAt: sendNow ? new Date() : null,
        createdById: session.id,
      },
    });

    if (sendNow) {
      const emailResult = await sendOfferEmail({
        candidateFirst: offer.candidateFirst,
        candidateLast: offer.candidateLast,
        candidateEmail: offer.candidateEmail,
        candidatePhone: offer.candidatePhone,
        jobTitle: offer.jobTitle,
        payType: offer.payType,
        payRate: offer.payRate,
        payFrequency: offer.payFrequency,
        startDate: offer.startDate,
        workType: offer.workType,
        token: offer.token,
      });

      if (!emailResult.ok) {
        await prisma.jobOffer.update({
          where: { id: offer.id },
          data: { status: "DRAFT", sentAt: null },
        });
        return apiError("Email failed", emailResult.reason, 500);
      }
    }

    return Response.json(apiSuccess(offer, sendNow ? "Offer sent" : "Offer saved as draft"), { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create offer";
    return apiError("Failed", msg, 500);
  }
}
