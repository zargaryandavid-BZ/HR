import { AdminPointsPageClient } from "@/components/admin/points/admin-points-page-client";
import { prisma } from "@/lib/prisma";

/** Conduct points overview page. */
export default async function AdminPointsPage() {
  await prisma.pointViolation.updateMany({
    where: { expiresAt: { lte: new Date() }, isExpired: false },
    data: { isExpired: true },
  });
  return <AdminPointsPageClient />;
}
