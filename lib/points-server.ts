import { getTier, type PointTierInfo } from "@/lib/points";

export const POINT_EXPIRY_MONTHS = 12;

type PointViolationLike = {
  id: string;
  points: number;
  reason: string;
  violationType: string | null;
  incidentDate: Date;
  expiresAt: Date;
  isExpired: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type PointSummary = {
  totalActivePoints: number;
  tier: PointTierInfo;
  activeViolations: PointViolationLike[];
  expiredViolations: PointViolationLike[];
  nextExpiry: Date | null;
};

/** Return the default one-year expiry for an incident. */
export function getDefaultPointExpiry(incidentDate: Date): Date {
  const expiresAt = new Date(incidentDate);
  expiresAt.setMonth(expiresAt.getMonth() + POINT_EXPIRY_MONTHS);
  return expiresAt;
}

/** Calculate active and expired violations, their point balance, and standing. */
export function calculatePointSummary(
  violations: PointViolationLike[],
  now = new Date()
): PointSummary {
  const activeViolations = violations.filter(
    (violation) => !violation.isExpired && violation.expiresAt > now
  );
  const expiredViolations = violations.filter(
    (violation) => violation.isExpired || violation.expiresAt <= now
  );
  const totalActivePoints = activeViolations.reduce(
    (total, violation) => total + violation.points,
    0
  );
  const nextExpiry =
    [...activeViolations].sort(
      (a, b) => a.expiresAt.getTime() - b.expiresAt.getTime()
    )[0]?.expiresAt ?? null;

  return {
    totalActivePoints,
    tier: getTier(totalActivePoints),
    activeViolations,
    expiredViolations,
    nextExpiry,
  };
}

/** Serialize point violation fields shared across API responses. */
export function mapViolation(violation: PointViolationLike) {
  return {
    id: violation.id,
    points: violation.points,
    reason: violation.reason,
    violationType: violation.violationType,
    incidentDate: violation.incidentDate.toISOString(),
    expiresAt: violation.expiresAt.toISOString(),
    isExpired: violation.isExpired || violation.expiresAt <= new Date(),
    createdAt: violation.createdAt.toISOString(),
    updatedAt: violation.updatedAt.toISOString(),
  };
}
