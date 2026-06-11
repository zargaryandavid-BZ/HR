import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

/** Public endpoint — returns active employees for the login name selector.
 *  Only exposes id + display name + masked phone. No auth required. */
export async function GET() {
  try {
    const employees = await prisma.employee.findMany({
      where: { status: "ACTIVE", phone: { not: null } },
      select: { id: true, firstName: true, lastName: true, phone: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    const data = employees.map((e) => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      // Mask phone: show last 4 digits only e.g. "+1 (747) ***-0173"
      maskedPhone: e.phone ? maskPhone(e.phone) : null,
    }));

    return Response.json(apiSuccess(data));
  } catch {
    return apiError("Server error", "Failed to load employees", 500);
  }
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***-****";
  const last4 = digits.slice(-4);
  const country = digits.startsWith("1") ? "+1" : `+${digits[0]}`;
  return `${country} (***) ***-${last4}`;
}
