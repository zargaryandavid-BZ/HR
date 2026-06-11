import { prisma } from "@/lib/prisma";

/** Generate a unique random 6-digit employee ID code (100000–999999) */
export async function generateEmployeeNumber(): Promise<string> {
  const MAX_ATTEMPTS = 20;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const existing = await prisma.employee.findUnique({
      where: { employeeNumber: code },
      select: { id: true },
    });
    if (!existing) return code;
  }

  throw new Error("Could not generate a unique employee number after multiple attempts");
}
