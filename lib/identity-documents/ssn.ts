/** Strip non-digits and cap at 9 characters for SSN entry */
export function stripSsnDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 9);
}

/** Format digit string as XXX-XX-XXXX */
export function formatSsnDisplay(digits: string): string {
  const d = stripSsnDigits(digits);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

/** Validate SSN has exactly 9 digits */
export function isValidSsn(value: string | null | undefined): boolean {
  return stripSsnDigits(value ?? "").length === 9;
}

/** Normalize SSN to formatted storage value */
export function normalizeSsnForStorage(value: string): string {
  return formatSsnDisplay(stripSsnDigits(value));
}
