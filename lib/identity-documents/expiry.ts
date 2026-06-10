import { addDays, startOfDay } from "date-fns";

export type ExpiryStatus = "expired" | "expiring_soon" | "ok";

/** Classify an identity document expiry date relative to today */
export function getExpiryStatus(
  expiryDate: Date | string | null | undefined,
  soonDays = 60
): ExpiryStatus | null {
  if (!expiryDate) return null;

  const expiry = startOfDay(new Date(expiryDate));
  const today = startOfDay(new Date());

  if (expiry < today) return "expired";
  if (expiry <= addDays(today, soonDays)) return "expiring_soon";
  return "ok";
}

/** True when expired or expiring within the given number of days */
export function isExpiringOrExpiredWithinDays(
  expiryDate: Date | null | undefined,
  days: number
): boolean {
  if (!expiryDate) return false;
  const status = getExpiryStatus(expiryDate, days);
  return status === "expired" || status === "expiring_soon";
}
