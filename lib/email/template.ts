function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type BrandedEmailOptions = {
  preheader?: string;
  greeting: string;
  bodyHtml: string;
  note?: string;
  ctaLabel: string;
  ctaUrl: string;
  footerNote?: string;
};

/** Branded HTML email layout for employee-facing notifications */
export function buildBrandedEmailHtml({
  preheader,
  greeting,
  bodyHtml,
  note,
  ctaLabel,
  ctaUrl,
  footerNote,
}: BrandedEmailOptions): string {
  const safeGreeting = escapeHtml(greeting);
  const safeCtaLabel = escapeHtml(ctaLabel);
  const safeCtaUrl = escapeHtml(ctaUrl);
  const safePreheader = preheader ? escapeHtml(preheader) : "";
  const safeFooterNote = footerNote ? escapeHtml(footerNote) : "";
  const normalizedBodyHtml = bodyHtml.replace(/>\s+</g, "><").trim();
  const noteBlock = note
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0 0;">
         <tr>
           <td style="background:#f4f4f5;border-left:4px solid #2563eb;border-radius:6px;padding:16px 18px;">
             <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#71717a;">
               Note from HR
             </p>
             <p style="margin:0;font-size:15px;line-height:1.6;color:#27272a;">
               ${escapeHtml(note)}
             </p>
           </td>
         </tr>
       </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bazaar Printing HR</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
    ${safePreheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${safePreheader}</div>` : ""}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(24,24,27,0.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%);padding:28px 32px;text-align:center;">
                <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.78);">
                  Employee Portal
                </p>
                <h1 style="margin:0;font-size:24px;line-height:1.3;font-weight:700;color:#ffffff;">
                  Bazaar Printing HR
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#18181b;">
                  Hi ${safeGreeting},
                </p>
                <div style="margin:0;padding:0;font-size:16px;line-height:1.6;color:#3f3f46;">
                  ${normalizedBodyHtml}
                </div>
                ${noteBlock}
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:20px 0 0;">
                  <tr>
                    <td style="border-radius:8px;background:#2563eb;display:inline-block;">
                      <a href="${safeCtaUrl}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;white-space:nowrap;">
                        ${safeCtaLabel}
                      </a>
                    </td>
                  </tr>
                </table>
                ${
                  safeFooterNote
                    ? `<p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:#71717a;text-align:center;">
                         ${safeFooterNote}
                       </p>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px;border-top:1px solid #e4e4e7;background:#fafafa;text-align:center;">
                <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#a1a1aa;">
                  This is an automated message from Bazaar Printing HR.
                </p>
                <p style="margin:0;font-size:12px;line-height:1.6;color:#a1a1aa;">
                  If you need help, contact your HR team.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
