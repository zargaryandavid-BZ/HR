export type SendEmailResult =
  | { ok: true }
  | { ok: false; reason: string };

function getInstantlySenderAccount(): string | null {
  return process.env.INSTANTLY_EACCOUNT ?? process.env.INSTANTLY_FROM_EMAIL ?? null;
}

function parseInstantlyError(status: number, errorBody: string): string {
  let detail = "";
  try {
    const json = JSON.parse(errorBody) as { message?: string; error?: string };
    detail = json.message ?? json.error ?? "";
  } catch {
    detail = errorBody.trim();
  }

  if (status === 401) {
    return "Instantly API key is invalid. Generate an API v2 key in Instantly → Settings → Integrations → API.";
  }
  if (status === 404 && detail.toLowerCase().includes("email account not found")) {
    const account = getInstantlySenderAccount() ?? "(not set)";
    return `Sender ${account} is not connected in Instantly. Set INSTANTLY_FROM_EMAIL to a connected inbox (e.g. team@bazaarprinting.co).`;
  }
  if (status === 402) {
    return "Instantly workspace does not have an active paid plan.";
  }

  return detail
    ? `Email provider rejected the request (${status}): ${detail}`
    : `Email provider rejected the request (${status}). Check Instantly API key and sender settings.`;
}

/** Send a transactional email via Instantly API */
export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string
): Promise<boolean> {
  const result = await sendEmailDetailed(to, subject, htmlBody);
  return result.ok;
}

/** Send email and return a specific failure reason for UI/logging */
export async function sendEmailDetailed(
  to: string,
  subject: string,
  htmlBody: string
): Promise<SendEmailResult> {
  const apiKey = process.env.INSTANTLY_API_KEY;
  const eaccount = getInstantlySenderAccount();

  if (!apiKey) {
    console.warn("Instantly API key not configured; email skipped");
    return {
      ok: false,
      reason:
        "Email service is not configured. Add INSTANTLY_API_KEY to your environment variables.",
    };
  }

  if (!eaccount) {
    return {
      ok: false,
      reason:
        "Email sender is not configured. Set INSTANTLY_FROM_EMAIL to a connected Instantly inbox.",
    };
  }

  try {
    const response = await fetch("https://api.instantly.ai/api/v2/emails/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        eaccount,
        to_address_email_list: to,
        subject,
        body: { html: htmlBody },
      }),
    });

    if (response.ok) {
      return { ok: true };
    }

    const errorBody = await response.text().catch(() => "");
    console.error("Instantly email failed:", response.status, errorBody);
    return { ok: false, reason: parseInstantlyError(response.status, errorBody) };
  } catch (error) {
    console.error("Instantly email error:", error);
    return { ok: false, reason: "Email provider request failed. Try again later." };
  }
}

/** Send welcome email to a new employee with login credentials */
export async function sendWelcomeEmail(
  email: string,
  name: string,
  tempPassword: string
): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return sendEmail(
    email,
    "Welcome to Bazaar Printing HR",
    `<p>Hi ${name},</p>
     <p>Your HR portal account has been created.</p>
     <p><strong>Login URL:</strong> <a href="${appUrl}/login">${appUrl}/login</a></p>
     <p><strong>Email:</strong> ${email}</p>
     <p><strong>Temporary Password:</strong> ${tempPassword}</p>
     <p>Please log in and change your password immediately.</p>`
  );
}
