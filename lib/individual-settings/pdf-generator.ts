import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Employee, Department } from "@prisma/client";
import { formatDisplayDate } from "@/lib/dates";

type EmployeeWithRelations = Employee & {
  department: Department | null;
  manager: Pick<Employee, "firstName" | "lastName"> | null;
};

/** Format pay frequency for offer letter */
function formatPayFrequency(freq: Employee["payFrequency"] | null | undefined): string {
  switch (freq) {
    case "WEEKLY":      return "weekly";
    case "BIWEEKLY":    return "bi-weekly";
    case "SEMI_MONTHLY": return "twice monthly";
    case "MONTHLY":     return "monthly";
    default:            return "bi-weekly";
  }
}

/** Format employment type for offer letter */
function formatEmploymentType(type: Employee["employmentType"]): string {
  return type.replace(/_/g, "-").toLowerCase();
}

/** Format pay rate based on pay type */
function formatPayRate(employee: Employee): string {
  if (employee.payRate == null) return "To be confirmed";
  if (employee.payType === "HOURLY") {
    return `$${employee.payRate.toFixed(2)}`;
  }
  return `$${Math.round(employee.payRate).toLocaleString("en-US")}`;
}

/** Format pay period label */
function formatPayPeriod(payType: Employee["payType"]): string {
  return payType === "HOURLY" ? "hour" : "year";
}

/** Format a date or return fallback */
function formatDateOrFallback(date: Date | null): string {
  if (!date) return "To be confirmed";
  return formatDisplayDate(date);
}

/** Wrap text to fit within a max width */
function wrapText(
  text: string,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  fontSize: number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, fontSize) <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Draw wrapped lines and return the new Y position */
function drawLines(
  page: ReturnType<PDFDocument["addPage"]>,
  lines: string[],
  x: number,
  startY: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  fontSize: number,
  lineHeight: number,
  color = rgb(0.1, 0.1, 0.1)
): number {
  let y = startY;
  for (const line of lines) {
    page.drawText(line, { x, y, size: fontSize, font, color });
    y -= lineHeight;
  }
  return y;
}

/** Generate an offer letter PDF for an employee */
export async function generateOfferLetterPdf(
  employee: EmployeeWithRelations
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 72;
  const contentWidth = 612 - margin * 2;
  let y = 720;

  page.drawText("Pixel Press Print Inc", { x: margin, y, size: 14, font: fontBold });
  y -= 18;
  page.drawText("1025 E 16th St, Los Angeles, CA, 90021", {
    x: margin,
    y,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 14;
  page.drawText("pixelpressprint.com", {
    x: margin,
    y,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  y -= 36;
  page.drawText(formatDisplayDate(new Date()), { x: margin, y, size: 11, font });
  y -= 28;

  const fullName = `${employee.firstName} ${employee.lastName}`;
  page.drawText(`Dear ${fullName},`, { x: margin, y, size: 11, font });
  y -= 24;

  const employmentType = formatEmploymentType(employee.employmentType);
  const jobTitle = employee.jobTitle ?? "Team Member";
  const startDate = formatDateOrFallback(employee.startDate);
  const payRate = formatPayRate(employee);
  const payPeriod = formatPayPeriod(employee.payType);
  const payFrequency = formatPayFrequency(employee.payFrequency);

  const paragraphs = [
    `Pixel Press Print Inc is delighted to offer you the ${employmentType} position of ${jobTitle} with an anticipated start date of ${startDate}, contingent upon completion of all required onboarding documents.`,
    `The starting pay for this position is ${payRate} per ${payPeriod}. Payment is on a ${payFrequency} basis by direct deposit.`,
    "Your employment with Pixel Press Print Inc will be on an at-will basis, which means you and the company are free to terminate employment at any time, with or without cause or advance notice. This letter is not a contract indicating employment terms or duration.",
  ];

  for (const paragraph of paragraphs) {
    const lines = wrapText(paragraph, font, 11, contentWidth);
    y = drawLines(page, lines, margin, y, font, 11, 16);
    y -= 8;
  }

  y -= 8;
  page.drawText("Sincerely,", { x: margin, y, size: 11, font });
  y -= 36;
  page.drawText("David Zargaryan", { x: margin, y, size: 11, font: fontBold });
  y -= 16;
  page.drawText("CEO, Pixel Press Print Inc", { x: margin, y, size: 11, font });

  y -= 48;
  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + contentWidth, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 24;

  const signatureLines = [
    "Candidate Signature: ______________________________",
    "Candidate Printed Name: ______________________________",
    "Date: ______________________________",
  ];
  for (const line of signatureLines) {
    page.drawText(line, { x: margin, y, size: 10, font });
    y -= 20;
  }

  return pdfDoc.save();
}

/** Generate a welcome email PDF for an employee */
export async function generateWelcomeEmailPdf(
  employee: EmployeeWithRelations
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 72;
  const contentWidth = 612 - margin * 2;
  let y = 720;

  const firstName = employee.firstName;
  const jobTitle = employee.jobTitle ?? "Team Member";
  const departmentName = employee.department?.name ?? "To be confirmed";
  const startDate = formatDateOrFallback(employee.startDate);
  const managerName = employee.manager
    ? `${employee.manager.firstName} ${employee.manager.lastName}`
    : "To be confirmed";

  page.drawText(`Subject: Welcome to Pixel Press Print, ${firstName}!`, {
    x: margin,
    y,
    size: 12,
    font: fontBold,
  });
  y -= 32;

  page.drawText(`Hi ${firstName},`, { x: margin, y, size: 11, font });
  y -= 24;

  const intro = "We're excited to welcome you to the Pixel Press Print team!";
  y = drawLines(page, wrapText(intro, font, 11, contentWidth), margin, y, font, 11, 16);
  y -= 12;

  const details = [
    `Your position: ${jobTitle}`,
    `Department: ${departmentName}`,
    `Start date: ${startDate}`,
    `Your manager: ${managerName}`,
  ];

  for (const detail of details) {
    page.drawText(detail, { x: margin, y, size: 11, font: fontBold });
    y -= 18;
  }

  y -= 8;
  const beforeDay =
    "Before your first day, please log in to your onboarding portal and complete all required steps and documents. Everything should be done on or before Day 1.";
  y = drawLines(
    page,
    wrapText(beforeDay, font, 11, contentWidth),
    margin,
    y,
    font,
    11,
    16
  );
  y -= 16;

  page.drawText("What to bring on Day 1:", { x: margin, y, size: 11, font: fontBold });
  y -= 18;

  const bringItems = [
    "- Government-issued photo ID",
    "- Social Security card (for I-9 verification)",
    "- Voided check or bank info for direct deposit",
  ];
  for (const item of bringItems) {
    page.drawText(item, { x: margin, y, size: 11, font });
    y -= 16;
  }

  y -= 8;
  const closingParagraphs = [
    "If you have any questions, don't hesitate to reach out.",
    "We look forward to having you with us!",
  ];
  for (const paragraph of closingParagraphs) {
    y = drawLines(
      page,
      wrapText(paragraph, font, 11, contentWidth),
      margin,
      y,
      font,
      11,
      16
    );
    y -= 8;
  }

  y -= 8;
  page.drawText("Warm regards,", { x: margin, y, size: 11, font });
  y -= 24;
  page.drawText("David Zargaryan", { x: margin, y, size: 11, font: fontBold });
  y -= 16;
  page.drawText("CEO, Pixel Press Print Inc", { x: margin, y, size: 11, font });
  y -= 16;
  page.drawText("+1 (747) 378-0173", { x: margin, y, size: 10, font });
  y -= 14;
  page.drawText("zargaryandavid@bazaarprinting.com", {
    x: margin,
    y,
    size: 10,
    font,
  });
  y -= 14;
  page.drawText("pixelpressprint.com", { x: margin, y, size: 10, font });

  return pdfDoc.save();
}
