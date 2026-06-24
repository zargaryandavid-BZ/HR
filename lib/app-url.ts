const PLACEHOLDER_APP_URL = /replace_with_your_vercel_url/i;

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function isPlaceholderAppUrl(url: string): boolean {
  return PLACEHOLDER_APP_URL.test(url);
}

/** Resolve the public app base URL for links in emails, SMS, and notifications */
export function getAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
  if (configured && !isPlaceholderAppUrl(configured)) {
    return stripTrailingSlash(configured);
  }

  if (process.env.VERCEL_URL) {
    return stripTrailingSlash(`https://${process.env.VERCEL_URL}`);
  }

  return "http://localhost:3000";
}

/** Employee portal login URL */
export function getEmployeePortalLoginUrl(appBaseUrl?: string): string {
  const base = appBaseUrl ? stripTrailingSlash(appBaseUrl) : getAppUrl();
  return `${base}/employee/login`;
}

/** Employee portal dashboard URL (used in HR notification email/SMS) */
export function getEmployeePortalDashboardUrl(appBaseUrl?: string): string {
  const base = appBaseUrl ? stripTrailingSlash(appBaseUrl) : getAppUrl();
  return `${base}/employee/dashboard`;
}
