import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type AuditPayload = {
  userId: string;
  action: string;
  targetId?: string;
  targetTable?: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason?: string;
};

/** Write an audit log entry for individual settings actions */
export async function logIndividualSettingsAudit({
  userId,
  action,
  targetId,
  targetTable = "Employee",
  oldValue,
  newValue,
  reason,
}: AuditPayload) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      targetId,
      targetTable,
      oldValue: (oldValue ?? undefined) as Prisma.InputJsonValue | undefined,
      newValue: (newValue ?? undefined) as Prisma.InputJsonValue | undefined,
      reason,
    },
  });
}
