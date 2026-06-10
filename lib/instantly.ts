/** Send a transactional email via Instantly API */
export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string
): Promise<boolean> {
  const apiKey = process.env.INSTANTLY_API_KEY;
  const fromEmail = process.env.INSTANTLY_FROM_EMAIL ?? "hr@bazaarprinting.com";
  const fromName = process.env.INSTANTLY_FROM_NAME ?? "Bazaar Printing HR";

  if (!apiKey) {
    console.warn("Instantly API key not configured; email skipped");
    return false;
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

    return response.ok;
  } catch (error) {
    console.error("Instantly email error:", error);
    return false;
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
