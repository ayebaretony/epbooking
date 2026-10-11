// The Excel version of a report: one sheet per ticked section, a summary sheet, and always a full list of the period's
// bookings (the same raw list the old system exported). Relative .ts imports so it is testable.
import { buildXlsx, type Cell, type Sheet } from "../../lib/xlsx.ts";
import { WEEKDAY_SHORT } from "../../lib/months.ts";
import { minutesToTime } from "../../lib/bookingMath.ts";
import type { ReportData } from "../../lib/report.ts";
import type { ReportSections } from "./reportPdf.ts";

const header = (...labels: string[]): Cell[] => labels.map((value) => ({ value, style: "header" as const }));
const money = (value: number): Cell => ({ value, style: "money" });
const integer = (value: number): Cell => ({ value, style: "integer" });

export function reportSheets(report: ReportData, sections: ReportSections, generatedOn: string): Sheet[] {
  const sheets: Sheet[] = [
    {
      name: "Summary",
      columnWidths: [26, 62],
      rows: [
        [{ value: "Palace Sports performance report", style: "title" }],
        ["Period", report.label],
        ["Generated", generatedOn],
        ["Note", "Revenue counts confirmed bookings. Cancelled bookings are left out."],
        [],
        header("Measure", "Value"),
        ["Total revenue (AED)", money(report.summary.revenue)],
        ["Bookings", integer(report.summary.bookings)],
        ["Average booking (AED)", report.summary.averageBooking === null ? "-" : money(report.summary.averageBooking)],
        ["Busiest pitch", report.busiestPitch ?? "-"],
      ],
    },
  ];

  if (sections.revenue)
    sheets.push({
      name: "By month",
      columnWidths: [16, 12, 18],
      rows: [header("Month", "Bookings", "Revenue (AED)"), ...report.months.map((m): Cell[] => [m.name, integer(m.bookings), money(m.revenue)])],
    });

  if (sections.pitches) {
    const total = report.pitches.reduce((sum, p) => sum + p.revenue, 0);
    sheets.push({
      name: "By pitch",
      columnWidths: [26, 12, 10, 18, 18],
      rows: [
        header("Pitch", "Bookings", "Hours", "Revenue (AED)", "Share of revenue"),
        ...report.pitches.map((p): Cell[] => [p.pitch, integer(p.bookings), p.hours, money(p.revenue), total > 0 ? `${Math.round((p.revenue / total) * 1000) / 10}%` : "-"]),
      ],
    });
  }

  if (sections.clients)
    sheets.push({
      name: "Top clients",
      columnWidths: [32, 12, 18],
      rows: [header("Client", "Bookings", "Revenue (AED)"), ...report.clients.map((c): Cell[] => [c.name, integer(c.bookings), money(c.revenue)])],
    });

  if (sections.utilisation)
    sheets.push({
      name: "Busy times",
      columnWidths: [10, ...WEEKDAY_SHORT.map(() => 8)],
      rows: [header("Hour", ...WEEKDAY_SHORT), ...report.utilisation.hours.map((hour, r): Cell[] => [minutesToTime(hour * 60), ...report.utilisation.counts[r].map(integer)])],
    });

  sheets.push({
    name: "Bookings",
    columnWidths: [12, 8, 8, 24, 28, 18, 8, 14, 14, 12],
    rows: [
      header("Date", "Start", "End", "Pitch", "Client", "Contact", "Hours", "Rate (AED/hr)", "Total (AED)", "Status"),
      ...report.bookings.map((b): Cell[] => [b.date, b.startTime, b.endTime, b.pitch, b.clientName, b.contact, b.hours, money(b.pricePerHour), money(b.totalPayment), b.status === "pending" ? "Pending" : "Confirmed"]),
    ],
  });
  return sheets;
}

export function renderReportXlsx(report: ReportData, sections: ReportSections, generatedOn: string): Uint8Array {
  return buildXlsx(reportSheets(report, sections, generatedOn));
}
