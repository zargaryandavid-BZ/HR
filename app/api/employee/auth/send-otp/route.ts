import { NextRequest } from "next/server";
import { z } from "zod";
import { addMinutes } from "date-fns";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/twilio";
import { apiSuccess, apiError } from "@/lib/api-response";

const schema = z.object({ phone: z.string().min(7) });

/** Send a 6-digit OTP to the employee's phone for portal login */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError("Validation failed", "Phone is required");

    const { phone } = parsed.data;
    const normalised = phone.replace(/\s/g, "");

    // Look up active employee by phone — intentionally vague response if not found
    const employee = await prisma.employee.findFirst({
      where: { phone: normalised, status: "ACTIVE" },
      select: { id: true },
    });

    if (employee) {
      // Expire any previous unused codes for this phone
      await prisma.employeeOTP.updateMany({
        where: { phone: normalised, usedAt: null },
        data: { usedAt: new Date() },
      });

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = addMinutes(new Date(), 10);

      await prisma.employeeOTP.create({
        data: { phone: normalised, code, expiresAt },
      });

      await sendSms(
        normalised,
        `Your Pixel Press Print login code is: ${code}. Expires in 10 minutes.`
      );
    }

    // Always return the same response
    return Response.json(
      apiSuccess(null, "If this number is registered, a code was sent")
    );
  } catch {
    return apiError("Server error", "Failed to send code", 500);
  }
}
