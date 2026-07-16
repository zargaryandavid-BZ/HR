export type PointTier = "CLEAR" | "WATCH" | "WARNING" | "CRITICAL" | "TERMINATION";

export interface PointTierInfo {
  tier: PointTier;
  label: string;
  min: number;
  max: number | null;
}

export const TIERS: PointTierInfo[] = [
  { tier: "CLEAR", label: "Clear", min: 0, max: 0 },
  { tier: "WATCH", label: "Watch", min: 1, max: 3 },
  { tier: "WARNING", label: "Warning", min: 4, max: 7 },
  { tier: "CRITICAL", label: "Critical", min: 8, max: 9 },
  { tier: "TERMINATION", label: "Termination review", min: 10, max: null },
];

/** Resolve the conduct standing for an active point total. */
export function getTier(totalPoints: number): PointTierInfo {
  return [...TIERS].reverse().find((tier) => totalPoints >= tier.min) ?? TIERS[0];
}
