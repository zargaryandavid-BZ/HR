/**
 * Server-side geofencing and network validation utilities.
 * All location math happens here — never trust the client for security decisions.
 */

export interface GpsCoords {
  lat: number;
  lng: number;
  accuracy?: number; // metres reported by browser
}

export interface LocationValidationResult {
  allowed: boolean;
  reason?: string;
  method?: "GPS" | "IP" | "UNCONFIGURED";
}

/**
 * Haversine formula — great-circle distance between two points in metres.
 */
export function haversineMetres(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Extract the real client IP from a Next.js request.
 * Prefers x-real-ip (set by a trusted reverse proxy) over x-forwarded-for
 * (which can be spoofed if there is no proxy in front).
 */
export function extractClientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/**
 * Validate that a clock-in request comes from the physical facility.
 *
 * Priority:
 *  1. GPS coords present + facility coords configured → Haversine check
 *  2. No GPS coords + office IP configured → IP check
 *  3. Nothing configured → unrestricted (dev / unconfigured)
 *
 * Environment variables:
 *   FACILITY_LAT          latitude of the production floor
 *   FACILITY_LNG          longitude of the production floor
 *   GEOFENCE_RADIUS_M     radius in metres (default 50)
 *   OFFICE_STATIC_IP      static IP of the office network
 */
export function validateClockInLocation(
  clientIp: string,
  coords: GpsCoords | null | undefined
): LocationValidationResult {
  const facilityLat = process.env.FACILITY_LAT
    ? parseFloat(process.env.FACILITY_LAT)
    : null;
  const facilityLng = process.env.FACILITY_LNG
    ? parseFloat(process.env.FACILITY_LNG)
    : null;
  const radiusM = process.env.GEOFENCE_RADIUS_M
    ? parseFloat(process.env.GEOFENCE_RADIUS_M)
    : 50;
  const officeIp = process.env.OFFICE_STATIC_IP ?? null;

  const gpsConfigured =
    facilityLat !== null && facilityLng !== null && !isNaN(facilityLat) && !isNaN(facilityLng);
  const ipConfigured = officeIp !== null && officeIp.trim() !== "";

  // ── Path 1: GPS validation ──────────────────────────────────────────────
  if (coords && gpsConfigured) {
    const dist = haversineMetres(coords.lat, coords.lng, facilityLat!, facilityLng!);
    if (dist <= radiusM) {
      return { allowed: true, method: "GPS" };
    }
    return {
      allowed: false,
      method: "GPS",
      reason: `You must be at the facility to clock in. You are ${Math.round(dist)} m away (limit: ${radiusM} m).`,
    };
  }

  // ── Path 2: IP validation ────────────────────────────────────────────────
  if (ipConfigured) {
    if (clientIp === officeIp) {
      return { allowed: true, method: "IP" };
    }
    return {
      allowed: false,
      method: "IP",
      reason: "Clock-in is only allowed from the office network.",
    };
  }

  // ── Path 3: Not configured — allow ─────────────────────────────────────
  return { allowed: true, method: "UNCONFIGURED" };
}
