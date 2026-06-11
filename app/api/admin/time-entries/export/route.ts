import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";
import type { Prisma } from "@prisma/client";

type EntryWithRelations = Prisma.TimeEntryGetPayload<{
  include: {
    employee: {
      select: {
        firstName: true;
        lastName: true;
        employeeNumber: true;
        payType: true;
        payRate: true;
        department: { select: { name: true } };
        position: { select: { name: true } };
      };
    };
    breaks: true;
  };
}>;

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function row(fields: (string | number | null | undefined)[]): string {
  return fields.map(escapeCsv).join(",");
}

export async function GET(req: NextRequest) {
  try {
    await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") ?? "week";
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const now = new Date();
    let start: Date, end: Date;

    if (range === "month") {
      start = startOfMonth(now); end = endOfMonth(now);
    } else if (range === "custom" && from && to) {
      start = startOfDay(new Date(from)); end = endOfDay(new Date(to));
    } else {
      // default: current week
      start = startOfWeek(now, { weekStartsOn: 1 });
      end = endOfWeek(now, { weekStartsOn: 1 });
    }

    const entries = await prisma.timeEntry.findMany({
      where: { clockIn: { gte: start, lte: end } },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
            payType: true,
            payRate: true,
            department: { select: { name: true } },
            position: { select: { name: true } },
          },
        },
        breaks: true,
      },
      orderBy: [{ employee: { lastName: "asc" } }, { clockIn: "asc" }],
    });

    // Build CSV
    const headers = [
      "Employee Name",
      "Employee #",
      "Department",
      "Position",
      "Date",
      "Clock In",
      "Clock Out",
      "Hours Worked",
      "Break Minutes",
      "Breaks Count",
      "Status",
      "Pay Type",
      "Pay Rate",
      "Estimated Pay",
      "Clock In Method",
      "Clock Out Method",
    ];

    const lines: string[] = [headers.join(",")];

    for (const entry of entries as EntryWithRelations[]) {
      const emp = entry.employee;
      const name = `${emp.lastName}, ${emp.firstName}`;
      const date = format(new Date(entry.clockIn), "yyyy-MM-dd");
      const clockIn = format(new Date(entry.clockIn), "h:mm a");
      const clockOut = entry.clockOut ? format(new Date(entry.clockOut), "h:mm a") : "";

      const totalBreakMin = entry.breaks.reduce((sum, b) => sum + (b.durationMin ?? 0), 0);
      const hours = entry.hoursWorked ?? null;

      const payRate = emp.payRate ?? null;
      const estimatedPay =
        emp.payType === "HOURLY" && hours != null && payRate != null
          ? (hours * payRate).toFixed(2)
          : emp.payType === "SALARY" && payRate != null
          ? (payRate / 26).toFixed(2)   // bi-weekly salary equivalent
          : "";

      lines.push(row([
        name,
        emp.employeeNumber ?? "",
        emp.department?.name ?? "",
        emp.position?.name ?? "",
        date,
        clockIn,
        clockOut,
        hours != null ? hours.toFixed(4) : "",
        totalBreakMin > 0 ? totalBreakMin.toFixed(1) : "0",
        entry.breaks.length,
        entry.status,
        emp.payType ?? "",
        payRate != null ? payRate.toFixed(2) : "",
        estimatedPay,
        entry.clockInMethod ?? "",
        entry.clockOutMethod ?? "",
      ]));
    }

    // Summary rows
    const typedEntries = entries as EntryWithRelations[];
    const totalHours = typedEntries.reduce((s, e) => s + (e.hoursWorked ?? 0), 0);
    const totalPay = typedEntries.reduce((s, e) => {
      const emp = e.employee;
      if (emp.payType === "HOURLY" && e.hoursWorked != null && emp.payRate != null) {
        return s + e.hoursWorked * emp.payRate;
      }
      return s;
    }, 0);

    lines.push(""); // blank line
    lines.push(row(["TOTALS", "", "", "", "", "", "", totalHours.toFixed(4), "", entries.length + " entries", "", "", "", totalPay.toFixed(2), "", ""]));

    const label = range === "custom" && from && to
      ? `${from}_to_${to}`
      : range === "month"
      ? format(now, "yyyy-MM")
      : `week-of-${format(start, "yyyy-MM-dd")}`;

    const filename = `timesheet-${label}.csv`;
    const csv = lines.join("\r\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[timesheet export]", err);
    return new Response("Export failed", { status: 500 });
  }
}
