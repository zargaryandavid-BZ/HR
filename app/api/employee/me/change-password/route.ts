import { NextRequest } from "next/server";
import { z } from "zod";
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getEmployeeSession } from "@/lib/employee-session";

const schema = z.object({
  oldPassword: z.string(),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, storedHash] = stored.split(":");
  if (!salt || !storedHash) return false;
  const hash = pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
  try {
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(storedHash, "hex"));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation error", parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }

    const { oldPassword, newPassword } = parsed.data;

    const employee = await prisma.employee.findUnique({
      where: { id: session.employeeId },
      select: { id: true, portalPinHash: true },
    });
    if (!employee) return apiError("Unauthorized", "Employee not found", 401);

    // If a password is already set, verify the old one
    if (employee.portalPinHash) {
      if (!oldPassword) {
        return apiError("Validation error", "Current password is required", 400);
      }
      if (!verifyPassword(oldPassword, employee.portalPinHash)) {
        return apiError("Unauthorized", "Current password is incorrect", 401);
      }
    }

    const newHash = hashPassword(newPassword);
    await prisma.employee.update({
      where: { id: session.employeeId },
      data: { portalPinHash: newHash },
    });

    return Response.json(apiSuccess(null, "Password updated successfully"));
  } catch {
    return apiError("Server error", "Failed to update password", 500);
  }
}
