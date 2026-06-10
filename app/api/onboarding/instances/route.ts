import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { triggerOnboardingSchema } from "@/lib/validations";
import { createOnboardingInstance } from "@/lib/onboarding/service";

/** Trigger onboarding for an employee */
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);
    const body = await request.json();
    const parsed = triggerOnboardingSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const instance = await createOnboardingInstance(
      parsed.data.employeeId,
      parsed.data.templateId,
      session.id
    );

    return Response.json(apiSuccess(instance, "Onboarding sent"), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to trigger onboarding";
    return apiError("Failed", message);
  }
}
