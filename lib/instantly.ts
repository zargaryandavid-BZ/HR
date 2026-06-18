export type SendEmailResult =
  | { ok: true }
  | { ok: false; reason: string };

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
  const fromEmail = process.env.INSTANTLY_FROM_EMAIL ?? "hr@bazaarprinting.com";
  const fromName = process.env.INSTANTLY_FROM_NAME ?? "Bazaar Printing HR";

  if (!apiKey) {
    console.warn("Instantly API key not configured; email skipped");
    return {
      ok: false,
      reason:
        "Email service is not configured. Add INSTANTLY_API_KEY to your environment variables.",
    };
  }

  try {
    const response = await fetch("https://api.instantly.ai/api/v1/unibox/emails/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        to,
        from: fromEmail,
        from_name: fromName,
        subject,
        body: htmlBody,
      }),
    });

    if (response.ok) {
      return { ok: true };
    }

    const errorBody = await response.text().catch(() => "");
    console.error("Instantly email failed:", response.status, errorBody);
    return {
      ok: false,
      reason: `Email provider rejected the request (${response.status}). Check Instantly API key and sender settings.`,
    };
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
