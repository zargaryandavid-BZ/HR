export const WRITEUP_CONFIRMATION_PHRASE = "I confirm and accept";

/** Returns true when the typed phrase matches the required acknowledgment text */
export function isWriteUpConfirmationValid(input: string): boolean {
  return input.trim().toLowerCase() === WRITEUP_CONFIRMATION_PHRASE.toLowerCase();
}

/** Resolve acknowledgment timestamp from new or legacy fields */
export function getWriteUpAcknowledgedAt(writeUp: {
  acknowledgedAt: Date | string | null;
  employeeSignedAt?: Date | string | null;
}): Date | null {
  const acknowledged = writeUp.acknowledgedAt ?? writeUp.employeeSignedAt ?? null;
  if (!acknowledged) return null;
  return acknowledged instanceof Date ? acknowledged : new Date(acknowledged);
}

/** Returns true when a write-up has been acknowledged */
export function isWriteUpAcknowledged(writeUp: {
  acknowledgedAt: Date | string | null;
  employeeSignedAt?: Date | string | null;
}): boolean {
  return getWriteUpAcknowledgedAt(writeUp) !== null;
}
