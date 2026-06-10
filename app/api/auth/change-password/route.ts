import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

/** Clear the mustChangePassword flag after successful password update */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return apiError("Unauthorized", "Not authenticated", 401);
  }

  await prisma.user.update({
    where: { id: session.id },
    data: { mustChangePassword: false },
  });

  return Response.json(apiSuccess(null, "Password updated successfully"));
}
