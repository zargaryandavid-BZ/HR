import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { sendEmailDetailed } from "@/lib/instantly";
import { format } from "date-fns";

const schema = z.object({
  candidateFirst: z.string().min(1),
  candidateLast: z.string().min(1),
  candidateEmail: z.string().email("Valid email required"),
  jobTitle: z.string().min(1),
  startDate: z.string().min(1),
  payType: z.enum(["HOURLY", "SALARY"]),
  payRate: z.number().positive().optional(),
  payFrequency: z.enum(["WEEKLY", "BIWEEKLY", "SEMI_MONTHLY", "MONTHLY"]).optional(),
});

function formatCompensation(
  payType: "HOURLY" | "SALARY",
  payRate?: number,
  payFrequency?: string
): string {
  if (!payRate) return payType === "HOURLY" ? "Hourly rate TBD" : "Salary TBD";
  if (payType === "HOURLY") return `$${payRate.toFixed(2)} per hour`;
  const freqLabels: Record<string, string> = {
    WEEKLY: "weekly",
    BIWEEKLY: "bi-weekly",
    SEMI_MONTHLY: "twice monthly",
    MONTHLY: "monthly",
  };
  const freq = payFrequency ? (freqLabels[payFrequency] ?? "") : "";
  return `$${Math.round(payRate).toLocaleString("en-US")} per year${freq ? ` (${freq})` : ""}`;
}

function formatStartDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    return format(new Date(year, month - 1, day), "MMMM d, yyyy");
  } catch {
    return dateStr;
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const d = parsed.data;
    const fullName = `${d.candidateFirst} ${d.candidateLast}`;
    const compensation = formatCompensation(d.payType, d.payRate, d.payFrequency);
    const startDate = formatStartDate(d.startDate);

    const letterBodyHtml = `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#3f3f46;">
        We are pleased to extend an offer of employment for the position of
        <strong>${d.jobTitle}</strong>. We were impressed with your skills and experience
        and are excited about the potential you bring to our team.
      </p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
        style="margin:0 0 18px;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;border-collapse:separate;">
        <tr>
          <td style="padding:10px 16px;background:#f8fafc;border-bottom:1px solid #e4e4e7;font-size:12px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;width:130px;">
            Start Date
          </td>
          <td style="padding:10px 16px;border-bottom:1px solid #e4e4e7;font-size:14px;color:#18181b;">
            ${startDate}
          </td>
        </tr>
        <tr>
          <td style="padding:10px 16px;background:#f8fafc;font-size:12px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">
            Compensation
          </td>
          <td style="padding:10px 16px;font-size:14px;color:#18181b;">
            ${compensation}
          </td>
        </tr>
      </table>

      <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#18181b;">Contingencies</p>
      <p style="margin:0 0 8px;font-size:14px;line-height:1.7;color:#3f3f46;">
        This offer may be contingent upon the successful completion of a background screening and drug test.
      </p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3f3f46;">
        Additionally, employment is contingent upon your ability to provide valid documentation for
        I-9 verification, which must be completed within 72 hours of your hire date.
      </p>

      <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#18181b;">Introductory Period</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3f3f46;">
        Your employment will begin with a 30-day introductory period. This period allows both you and
        the Company to assess mutual fit and performance, and provides time to evaluate your progress,
        attendance, and overall suitability for the role.
      </p>

      <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#18181b;">Company Policies</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3f3f46;">
        As an employee, you are expected to comply with all Company policies, procedures, and standards
        of conduct at all times. These policies are designed to support a safe, professional, and
        productive work environment.
      </p>

      <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#18181b;">At-Will Employment</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3f3f46;">
        Please note that your employment with the company is at-will. This means that either you or the
        company can terminate the employment relationship at any time, with or without cause or notice.
      </p>

      <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3f3f46;">
        We are excited about the possibility of you joining our team and contributing to our continued
        success. If you have any questions or need further clarification, please feel free to contact us.
      </p>

      <p style="margin:0 0 4px;font-size:14px;color:#3f3f46;">Sincerely,</p>
      <p style="margin:0 0 20px;font-size:14px;font-weight:600;color:#18181b;">Hayk Zohrabyan, CEO</p>

      <div style="border-top:1px solid #e4e4e7;padding-top:16px;margin-top:8px;">
        <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#18181b;">Acceptance of Offer</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3f3f46;">
          I, <strong>${fullName}</strong>, accept the offer of employment for the position of
          <strong>${d.jobTitle}</strong>. I understand and agree to the terms and conditions outlined
          in this offer letter.
        </p>
        <p style="margin:0 0 6px;font-size:13px;color:#71717a;">
          Signature: ___________________________ &nbsp;&nbsp; Date: ___________________________
        </p>
        <p style="margin:0;font-size:13px;color:#71717a;">
          Name: ___________________________
        </p>
      </div>
    `;

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
        style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
        <tr>
          <td style="background:#1e40af;padding:24px 32px;text-align:center;">
            <p style="margin:0;color:#fff;font-size:18px;font-weight:700;">Bazaar Printing</p>
            <p style="margin:4px 0 0;color:#bfdbfe;font-size:12px;">HR Department &mdash; Offer Letter</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#18181b;">Dear <strong>${fullName}</strong>,</p>
            ${letterBodyHtml}
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e4e4e7;">
            <p style="margin:0;font-size:11px;color:#a1a1aa;">
              Bazaar Printing &bull; This offer letter was generated by the HR system.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const result = await sendEmailDetailed(
      d.candidateEmail,
      `Offer Letter — ${d.jobTitle} at Bazaar Printing`,
      html
    );

    if (!result.ok) {
      return apiError("Email failed", result.reason, 500);
    }

    return Response.json(apiSuccess(null, "Offer letter sent"));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    return apiError("Failed", msg, 500);
  }
}
