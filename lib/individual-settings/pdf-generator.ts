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

/** Build compensation line for offer letter */
function formatCompensation(employee: Employee): string {
  if (employee.payRate == null) return "To be confirmed";
  const payRate = formatPayRate(employee);
  const payPeriod = formatPayPeriod(employee.payType);
  const payFrequency = formatPayFrequency(employee.payFrequency);
  return `${payRate} per ${payPeriod} (${payFrequency})`;
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
  let page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 72;
  const contentWidth = pageWidth - margin * 2;
  const topY = 730;
  const bottomY = 64;
  let y = topY;

  const drawCenteredText = (
    text: string,
    size: number,
    textFont: Awaited<ReturnType<PDFDocument["embedFont"]>>,
    color = rgb(0.1, 0.1, 0.1)
  ) => {
    const width = textFont.widthOfTextAtSize(text, size);
    const x = (pageWidth - width) / 2;
    page.drawText(text, { x, y, size, font: textFont, color });
    y -= Math.ceil(size * 1.35);
  };

  const ensureSpace = (neededHeight: number) => {
    if (y - neededHeight < bottomY) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = topY;
    }
  };

  const drawWrappedText = (
    text: string,
    textFont: Awaited<ReturnType<PDFDocument["embedFont"]>>,
    fontSize = 11,
    lineHeight = 16
  ) => {
    const lines = wrapText(text, textFont, fontSize, contentWidth);
    for (const line of lines) {
      ensureSpace(lineHeight);
      page.drawText(line, { x: margin, y, size: fontSize, font: textFont });
      y -= lineHeight;
    }
  };

  const drawSectionHeading = (text: string) => {
    ensureSpace(20);
    page.drawText(text, { x: margin, y, size: 12, font: fontBold });
    y -= 18;
  };

  // Letterhead
  page.drawRectangle({
    x: margin,
    y: y - 8,
    width: contentWidth,
    height: 66,
    color: rgb(0.97, 0.97, 0.97),
  });
  y += 44;
  drawCenteredText("PixelPress Print  •  Bazaar Printing", 14, fontBold);
  drawCenteredText("HR Department", 10, font, rgb(0.35, 0.35, 0.35));
  y -= 12;
  drawCenteredText("OFFER LETTER", 13, fontBold);
  y -= 12;

  const fullName = `${employee.firstName} ${employee.lastName}`;
  const jobTitle = employee.jobTitle ?? "Team Member";
  const startDate = formatDateOrFallback(employee.startDate);
  const compensation = formatCompensation(employee);

  ensureSpace(56);
  page.drawText(`Date: ${formatDisplayDate(new Date())}`, { x: margin, y, size: 11, font });
  y -= 24;
  page.drawText(`Employee: ${fullName}`, { x: margin, y, size: 11, font });
  y -= 24;

  const intro =
    `We are pleased to extend an offer of employment for the position of ${jobTitle}. ` +
    "We were impressed with your skills and experience and are excited about the potential you bring to our team.";
  drawWrappedText(intro, font);
  y -= 12;

  ensureSpace(44);
  page.drawText(`Start Date: ${startDate}`, { x: margin, y, size: 11, font: fontBold });
  y -= 20;
  page.drawText(`Compensation: ${compensation}`, { x: margin, y, size: 11, font: fontBold });
  y -= 24;

  drawSectionHeading("Contingencies:");
  const contingencies = [
    "This offer may be contingent upon the successful completion of a background screening and drug test.",
    "Additionally, employment is contingent upon your ability to provide valid documentation for I-9 verification, which must be completed within 72 hours of your hire date.",
  ];
  for (const paragraph of contingencies) {
    drawWrappedText(paragraph, font);
    y -= 8;
  }

  drawSectionHeading("Introductory Period");
  drawWrappedText(
    "Your employment will begin with a 30-day introductory period. This period allows both you and the Company to assess mutual fit and performance, and provides time to evaluate your progress, attendance, and overall suitability for the role.",
    font
  );
  y -= 8;

  drawSectionHeading("Company Policies");
  drawWrappedText(
    "As an employee, you are expected to comply with all Company policies, procedures, and standards of conduct at all times. These policies are designed to support a safe, professional, and productive work environment.",
    font
  );
  y -= 8;

  drawSectionHeading("At-Will Employment:");
  drawWrappedText(
    "Please note that your employment with the company is at-will. This means that either you or the company can terminate the employment relationship at any time, with or without cause or notice.",
    font
  );
  y -= 8;

  drawWrappedText(
    "We are excited about the possibility of you joining our team and contributing to our continued success. If you have any questions or need further clarification, please feel free to contact us.",
    font
  );

  y -= 12;
  ensureSpace(52);
  page.drawText("Sincerely,", { x: margin, y, size: 11, font });
  y -= 22;
  page.drawText("Hayk Zohrabyan, CEO", { x: margin, y, size: 11, font: fontBold });
  y -= 16;
  page.drawText("Pixel Press Print Inc", { x: margin, y, size: 11, font });

  y -= 20;
  page.drawText("Acceptance of Offer", { x: margin, y, size: 11, font: fontBold });
  y -= 16;
  drawWrappedText(
    `I, ${fullName}, accept the offer of employment for the position of ${jobTitle}. I understand and agree to the terms and conditions outlined in this offer letter.`,
    font
  );
  y -= 16;

  ensureSpace(30);
  page.drawText("Signature: ___________________________  Date: ___________________________", {
    x: margin,
    y,
    size: 10,
    font,
  });
  y -= 14;
  page.drawText("Name: _______________________________", { x: margin, y, size: 10, font });

  y -= 22;
  ensureSpace(20);
  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + contentWidth, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 14;
  page.drawText(`Generated on ${formatDisplayDate(new Date())}`, {
    x: margin,
    y,
    size: 9,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

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
