import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { signEmployeeToken, buildSessionCookieHeader } from "@/lib/employee-session";

const schema = z.union([
  z.object({ employeeId: z.string().min(1), code: z.string().length(6) }),
  z.object({ phone: z.string().min(7), code: z.string().length(6) }),
]);

/** Verify OTP code, set employee session cookie */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError("Validation failed", "employeeId/phone and 6-digit code required");

    const { code } = parsed.data;
    const now = new Date();

    // Resolve phone from employeeId or use phone directly
    let phone: string | null = null;
    let employeeId: string | null = null;

    if ("employeeId" in parsed.data) {
      const emp = await prisma.employee.findFirst({
        where: { id: parsed.data.employeeId, status: "ACTIVE" },
        select: { id: true, phone: true },
      });
      if (!emp) return apiError("Not found", "Employee not found", 404);
      phone = emp.phone;
      employeeId = emp.id;
    } else {
      phone = parsed.data.phone.replace(/\s/g, "");
      const emp = await prisma.employee.findFirst({
        where: { phone, status: "ACTIVE" },
        select: { id: true },
      });
      if (!emp) return apiError("Not found", "Employee not found", 404);
      employeeId = emp.id;
    }

    if (!phone) return apiError("No phone", "No phone number on file", 400);

    const otp = await prisma.employeeOTP.findFirst({
      where: { phone, code, usedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!otp) return apiError("Invalid code", "Incorrect code. Try again.", 401);
    if (otp.expiresAt < now) return apiError("Expired", "Code expired. Request a new one.", 401);

    await prisma.employeeOTP.update({
      where: { id: otp.id },
      data: { usedAt: now },
    });

    const token = await signEmployeeToken({ employeeId, phone });
    const response = Response.json(apiSuccess({ employeeId }, "Login successful"));
    response.headers.set("Set-Cookie", buildSessionCookieHeader(token));
    return response;
  } catch {
    return apiError("Server error", "Failed to verify code", 500);
  }
}
