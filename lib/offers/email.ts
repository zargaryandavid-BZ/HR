import { sendEmailDetailed } from "@/lib/instantly";
import { buildBrandedEmailHtml } from "@/lib/email/template";
import { sendSms } from "@/lib/twilio";
import { getAppUrl } from "@/lib/app-url";
import type { PayType, PayFrequency, WorkType } from "@prisma/client";
import { format } from "date-fns";

type SendOfferEmailParams = {
  candidateFirst: string;
  candidateLast: string;
  candidateEmail: string;
  candidatePhone?: string | null;
  jobTitle: string;
  payType: PayType;
  payRate: number | null;
  payFrequency: PayFrequency | null;
  startDate: Date;
  workType: WorkType;
  token: string;
};

function formatPay(payType: PayType, payRate: number | null, payFrequency: PayFrequency | null): string {
  if (!payRate) return payType === "HOURLY" ? "Hourly rate TBD" : "Salary TBD";
  if (payType === "HOURLY") return `$${payRate.toLocaleString()}/hr`;
  const freqLabel: Record<string, string> = {
    WEEKLY: "/week",
    BIWEEKLY: "/biweek",
    SEMI_MONTHLY: "/semi-month",
    MONTHLY: "/month",
  };
  return `$${payRate.toLocaleString()}${payFrequency ? (freqLabel[payFrequency] ?? "") : ""}`;
}

function formatWorkType(wt: WorkType): string {
  return wt === "REMOTE" ? "Remote" : wt === "HYBRID" ? "Hybrid" : "On-site";
}

export async function sendOfferEmail(params: SendOfferEmailParams) {
  const appUrl = getAppUrl();
  const offerUrl = `${appUrl}/candidate/${params.token}`;

  const html = buildBrandedEmailHtml({
    preheader: `You have a job offer from Bazaar Printing — ${params.jobTitle}`,
    greeting: `${params.candidateFirst} ${params.candidateLast}`,
    bodyHtml: `
      <p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#3f3f46;">
        We are excited to offer you the following position at <strong>Bazaar Printing</strong>:
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;border-collapse:separate;">
        <tr>
          <td style="padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e4e4e7;font-size:13px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">
            Position
          </td>
          <td style="padding:12px 16px;border-bottom:1px solid #e4e4e7;font-size:15px;font-weight:600;color:#18181b;">
            <span style="display:block;margin:0;">${params.jobTitle}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e4e4e7;font-size:13px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">
            Compensation
          </td>
          <td style="padding:12px 16px;border-bottom:1px solid #e4e4e7;font-size:15px;color:#18181b;">
            <span style="display:block;margin:0;">
              ${formatPay(params.payType, params.payRate, params.payFrequency)}
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e4e4e7;font-size:13px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">
            Start Date
          </td>
          <td style="padding:12px 16px;border-bottom:1px solid #e4e4e7;font-size:15px;color:#18181b;">
            <span style="display:block;margin:0;">
              ${format(new Date(params.startDate), "MMMM d, yyyy")}
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;background:#f8fafc;font-size:13px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">
            Work Type
          </td>
          <td style="padding:12px 16px;font-size:15px;color:#18181b;">
            <span style="display:block;margin:0;">${formatWorkType(params.workType)}</span>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:16px;line-height:1.6;color:#3f3f46;">
        Please review your offer details and let us know your decision. If you accept, you will be asked to complete a short intake form so we can get everything ready for your start date.
      </p>
    `,
    ctaLabel: "View & Respond to Offer",
    ctaUrl: offerUrl,
    footerNote: "This offer link is unique to you. Please do not share it.",
  });

  const emailResult = await sendEmailDetailed(
    params.candidateEmail,
    `Job Offer — ${params.jobTitle} at Bazaar Printing`,
    html
  );

  // Also send SMS if a phone number is provided
  if (params.candidatePhone) {
    await sendSms(
      params.candidatePhone,
      `Hi ${params.candidateFirst}, you have a job offer from Bazaar Printing for ${params.jobTitle}. Review and respond here: ${offerUrl}`
    );
  }

  return emailResult;
}
