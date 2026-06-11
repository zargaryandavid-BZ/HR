import { NextRequest } from "next/server";
import { z } from "zod";
import { createHash, randomBytes, pbkdf2Sync } from "crypto";
import { prisma } from "@/lib/prisma";
import { getEmployeeSession } from "@/lib/employee-session";
import { apiSuccess, apiError } from "@/lib/api-response";

const schema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

function hashPin(password: string, salt: string): string {
  return pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
}

function verifyPin(password: string, stored: string): boolean {
  // Format: salt:hash
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  return hashPin(password, salt) === hash;
}

function createPinHash(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = hashPin(password, salt);
  return `${salt}:${hash}`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid input", 400);
    }

    const { oldPassword, newPassword } = parsed.data;

    const employee = await prisma.employee.findUnique({
      where: { id: session.employeeId },
      select: { id: true, portalPinHash: true },
    });

    if (!employee) return apiError("Not found", "Employee not found", 404);

    // If no password set yet, oldPassword must be empty string or "unset"
    if (employee.portalPinHash) {
      if (!verifyPin(oldPassword, employee.portalPinHash)) {
        return apiError("Incorrect password", "Old password is incorrect", 400);
      }
    }

    const newHash = createPinHash(newPassword);

    await prisma.employee.update({
      where: { id: session.employeeId },
      data: { portalPinHash: newHash },
    });

    return Response.json(apiSuccess(null, "Password updated successfully"));
  } catch {
    return apiError("Server error", "Failed to update password", 500);
  }
}
