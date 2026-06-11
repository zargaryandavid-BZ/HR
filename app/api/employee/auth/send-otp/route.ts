import { NextRequest } from "next/server";
import { z } from "zod";
import { addMinutes } from "date-fns";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/twilio";
import { apiSuccess, apiError } from "@/lib/api-response";

const schema = z.union([
  z.object({ employeeId: z.string().min(1) }),
  z.object({ phone: z.string().min(7) }),
]);

/** Send a 6-digit OTP to the employee's phone for portal login */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError("Validation failed", "employeeId or phone is required");

    let employee: { id: string; phone: string | null } | null = null;

    if ("employeeId" in parsed.data) {
      employee = await prisma.employee.findFirst({
        where: { id: parsed.data.employeeId, status: "ACTIVE" },
        select: { id: true, phone: true },
      });
    } else {
      const normalised = parsed.data.phone.replace(/\s/g, "");
      employee = await prisma.employee.findFirst({
        where: { phone: normalised, status: "ACTIVE" },
        select: { id: true, phone: true },
      });
    }

    if (employee?.phone) {
      const phone = employee.phone;

      await prisma.employeeOTP.updateMany({
        where: { phone, usedAt: null },
        data: { usedAt: new Date() },
      });

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = addMinutes(new Date(), 10);

      await prisma.employeeOTP.create({
        data: { phone, code, expiresAt },
      });

      await sendSms(phone, `Your Pixel Press Print login code is: ${code}. Expires in 10 minutes.`);
    }

    // Always return the same response to prevent enumeration
    return Response.json(apiSuccess(null, "If this account is registered, a code was sent"));
  } catch {
    return apiError("Server error", "Failed to send code", 500);
  }
}
