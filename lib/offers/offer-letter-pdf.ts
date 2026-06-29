import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { format } from "date-fns";

export type OfferLetterData = {
  candidateFirst: string;
  candidateLast: string;
  jobTitle: string;
  startDate: string; // YYYY-MM-DD
  payType: "HOURLY" | "SALARY";
  payRate?: number;
  payFrequency?: string;
};

function formatCompensation(data: OfferLetterData): string {
  if (!data.payRate) return data.payType === "HOURLY" ? "Hourly rate TBD" : "Salary TBD";
  if (data.payType === "HOURLY") return `$${data.payRate.toFixed(2)} per hour`;
  const freqLabels: Record<string, string> = {
    WEEKLY: "weekly",
    BIWEEKLY: "bi-weekly",
    SEMI_MONTHLY: "twice monthly",
    MONTHLY: "monthly",
  };
  const freq = data.payFrequency ? (freqLabels[data.payFrequency] ?? "") : "per year";
  return `$${Math.round(data.payRate).toLocaleString("en-US")} per year${freq ? ` (${freq})` : ""}`;
}

function formatStartDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    return format(new Date(year, month - 1, day), "MMMM d, yyyy");
  } catch {
    return dateStr;
  }
}

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

export async function generateOfferLetterPdfFromData(data: OfferLetterData): Promise<Uint8Array> {
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

  const ensureSpace = (needed: number) => {
    if (y - needed < bottomY) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = topY;
    }
  };

  const drawWrapped = (text: string, f = font, size = 11, lineH = 16) => {
    for (const line of wrapText(text, f, size, contentWidth)) {
      ensureSpace(lineH);
      page.drawText(line, { x: margin, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
      y -= lineH;
    }
  };

  const drawHeading = (text: string) => {
    ensureSpace(22);
    page.drawText(text, { x: margin, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    y -= 18;
  };

  const centerText = (text: string, size: number, f = font) => {
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (pageWidth - w) / 2, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
    y -= Math.ceil(size * 1.4);
  };

  // Header background
  page.drawRectangle({
    x: margin,
    y: y - 8,
    width: contentWidth,
    height: 60,
    color: rgb(0.97, 0.97, 0.97),
  });
  y += 38;
  centerText("Bazaar Printing", 14, fontBold);
  centerText("HR Department", 10);
  y -= 6;
  centerText("OFFER LETTER", 12, fontBold);
  y -= 16;

  const fullName = `${data.candidateFirst} ${data.candidateLast}`;
  const today = format(new Date(), "MMMM d, yyyy");

  // Date & employee
  ensureSpace(52);
  page.drawText(`Date: ${today}`, { x: margin, y, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
  y -= 20;
  page.drawText(`Employee: ${fullName}`, { x: margin, y, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
  y -= 20;

  drawWrapped(
    `We are pleased to extend an offer of employment for the position of ${data.jobTitle}. ` +
    "We were impressed with your skills and experience and are excited about the potential you bring to our team."
  );
  y -= 10;

  // Start date & compensation (bold labels)
  ensureSpace(46);
  page.drawText("Start Date: ", { x: margin, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(formatStartDate(data.startDate), {
    x: margin + fontBold.widthOfTextAtSize("Start Date: ", 11),
    y,
    size: 11,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 20;
  page.drawText("Compensation: ", { x: margin, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(formatCompensation(data), {
    x: margin + fontBold.widthOfTextAtSize("Compensation: ", 11),
    y,
    size: 11,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 20;

  // Contingencies
  drawHeading("Contingencies:");
  drawWrapped(
    "This offer may be contingent upon the successful completion of a background screening and drug test."
  );
  y -= 6;
  drawWrapped(
    "Additionally, employment is contingent upon your ability to provide valid documentation for I-9 " +
    "verification, which must be completed within 72 hours of your hire date."
  );
  y -= 10;

  // Introductory Period
  drawHeading("Introductory Period");
  drawWrapped(
    "Your employment will begin with a 30-day introductory period. This period allows both you and the " +
    "Company to assess mutual fit and performance, and provides time to evaluate your progress, " +
    "attendance, and overall suitability for the role."
  );
  y -= 10;

  // Company Policies
  drawHeading("Company Policies");
  drawWrapped(
    "As an employee, you are expected to comply with all Company policies, procedures, and standards of " +
    "conduct at all times. These policies are designed to support a safe, professional, and productive " +
    "work environment."
  );
  y -= 10;

  // At-Will Employment
  drawHeading("At-Will Employment:");
  drawWrapped(
    "Please note that your employment with the company is at-will. This means that either you or the " +
    "company can terminate the employment relationship at any time, with or without cause or notice."
  );
  y -= 10;

  drawWrapped(
    "We are excited about the possibility of you joining our team and contributing to our continued " +
    "success. If you have any questions or need further clarification, please feel free to contact us."
  );
  y -= 14;

  // Closing
  ensureSpace(56);
  page.drawText("Sincerely,", { x: margin, y, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
  y -= 22;
  page.drawText("Hayk Zohrabyan, CEO", { x: margin, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  y -= 30;

  // Acceptance block
  drawHeading("Acceptance of Offer");
  drawWrapped(
    `I, ${fullName}, accept the offer of employment for the position of ${data.jobTitle}. ` +
    "I understand and agree to the terms and conditions outlined in this offer letter."
  );
  y -= 20;

  // Signature lines
  ensureSpace(36);
  page.drawText(
    "Signature: ___________________________   Date: ___________________________",
    { x: margin, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) }
  );
  y -= 16;
  page.drawText("Name: _______________________________", { x: margin, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
  y -= 24;

  // Footer rule
  ensureSpace(20);
  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + contentWidth, y },
    thickness: 0.5,
    color: rgb(0.75, 0.75, 0.75),
  });
  y -= 14;
  page.drawText(`Generated on ${today}`, { x: margin, y, size: 9, font, color: rgb(0.45, 0.45, 0.45) });

  return pdfDoc.save();
}
