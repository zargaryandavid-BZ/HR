import { prisma } from "@/lib/prisma";
import { logIndividualSettingsAudit } from "@/lib/individual-settings/audit";
import { isWriteUpAcknowledged } from "@/lib/writeups/constants";

export type AcknowledgeWriteUpResult = {
  acknowledgedAt: string;
  acknowledgedBy: string;
};

/** Acknowledge a write-up for the authenticated employee and log the action */
export async function acknowledgeEmployeeWriteUp(
  writeUpId: string,
  employeeId: string
): Promise<AcknowledgeWriteUpResult> {
  const writeUp = await prisma.writeUp.findFirst({
    where: { id: writeUpId, employeeId },
  });

  if (!writeUp) {
    throw new Error("Write-up not found");
  }

  if (isWriteUpAcknowledged(writeUp)) {
    throw new Error("Already acknowledged");
  }

  const acknowledgedAt = new Date();
  const updated = await prisma.writeUp.update({
    where: { id: writeUpId },
    data: {
      acknowledgedAt,
      acknowledgedBy: employeeId,
    },
  });

  const linkedUser = await prisma.user.findFirst({
    where: { employeeId },
    select: { id: true },
  });

  try {
    await logIndividualSettingsAudit({
      userId: linkedUser?.id ?? writeUp.issuedBy,
      action: "WRITEUP_ACKNOWLEDGED",
      targetId: writeUpId,
      targetTable: "WriteUp",
      newValue: {
        writeUpId,
        employeeId,
        acknowledgedAt: updated.acknowledgedAt?.toISOString(),
        acknowledgedBy: updated.acknowledgedBy,
      },
    });
  } catch (auditError) {
    console.error("Write-up acknowledgment audit failed:", auditError);
  }

  return {
    acknowledgedAt: updated.acknowledgedAt!.toISOString(),
    acknowledgedBy: updated.acknowledgedBy!,
  };
}
