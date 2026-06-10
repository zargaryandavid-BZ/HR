import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { signEmployeeToken, buildSessionCookieHeader } from "@/lib/employee-session";

const schema = z.object({
  phone: z.string().min(7),
  code: z.string().length(6),
});

/** Verify OTP code, set employee session cookie */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError("Validation failed", "Phone and 6-digit code required");

    const { phone, code } = parsed.data;
    const normalised = phone.replace(/\s/g, "");
    const now = new Date();

    const otp = await prisma.employeeOTP.findFirst({
      where: { phone: normalised, code, usedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!otp) {
      return apiError("Invalid code", "Incorrect code. Try again.", 401);
    }

    if (otp.expiresAt < now) {
      return apiError("Expired", "Code expired. Request a new one.", 401);
    }

    // Mark OTP used
    await prisma.employeeOTP.update({
      where: { id: otp.id },
      data: { usedAt: now },
    });

    // Get employee record
    const employee = await prisma.employee.findFirst({
      where: { phone: normalised, status: "ACTIVE" },
      select: { id: true },
    });

    if (!employee) {
      return apiError("Not found", "Employee not found", 404);
    }

    const token = await signEmployeeToken({ employeeId: employee.id, phone: normalised });

    const response = Response.json(apiSuccess({ employeeId: employee.id }, "Login successful"));
    response.headers.set("Set-Cookie", buildSessionCookieHeader(token));
    return response;
  } catch {
    return apiError("Server error", "Failed to verify code", 500);
  }
}
