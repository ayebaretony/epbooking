// Lays a report out as a PDF: a title band, then the sections the person ticked (revenue summary with a chart, booking
// breakdown by pitch, top repeat clients, utilisation overview), with page numbers. Relative .ts imports so it is testable.
import { minutesToTime } from "../../lib/bookingMath.ts";
import { formatAed, formatPercentChange } from "../../lib/money.ts";
import { WEEKDAY_SHORT } from "../../lib/months.ts";
import { PAGE_HEIGHT, PAGE_WIDTH, PdfDocument, fitText, textWidth } from "../../lib/pdf.ts";
import type { ReportData } from "../../lib/report.ts";

export type ReportSections = { revenue: boolean; pitches: boolean; clients: boolean; utilisation: boolean };

const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const TOP = 56; // where content starts on pages after the first
const BOTTOM = PAGE_HEIGHT - 56; // content stops here, above the footer
const PRIMARY = "#245521";
const INK = "#121a14";
const MUTED = "#5d6a60";
const LINE = "#dce5da";
const TINT = "#eff6ef";
const WEEKDAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const money = (amount: number, currency: string) => formatAed(amount, currency);

// 1234 -> "1.2k", 800 -> "800"
const short = (value: number) => (value >= 1000 ? `${Math.round(value / 100) / 10}k` : String(Math.round(value)));

// The next "round" number above the biggest bar, so the chart's top line is tidy: 28450 -> 30000
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) if (value <= step * magnitude) return step * magnitude;
  return 10 * magnitude;
}

// Mixes two #rrggbb colours: 0 gives `from`, 1 gives `to`
function mix(from: string, to: string, amount: number): string {
  const channel = (hex: string, at: number) => parseInt(hex.slice(at, at + 2), 16);
  return "#" + [1, 3, 5].map((at) => Math.round(channel(from, at) + (channel(to, at) - channel(from, at)) * amount).toString(16).padStart(2, "0")).join("");
}

function wrap(text: string, maxWidth: number, size: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const attempt = line ? `${line} ${word}` : word;
    if (textWidth(attempt, size) <= maxWidth || !line) line = attempt;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

type Column = { header: string; width: number; align?: "left" | "right" };

class Layout {
  y = 0;
  readonly doc: PdfDocument;
  constructor(doc: PdfDocument) {
    this.doc = doc;
  }

  // Starts a new page if `height` would not fit below the current position
  ensure(height: number) {
    if (this.y + height > BOTTOM) {
      this.doc.addPage();
      this.y = TOP;
    }
  }

  heading(title: string) {
    this.ensure(104); // keep the heading together with the start of what it introduces
    this.y += 10;
    this.doc.text(MARGIN, this.y + 12, title, { size: 13, bold: true, color: PRIMARY });
    this.doc.line(MARGIN, this.y + 20, MARGIN + CONTENT_WIDTH, this.y + 20, { color: LINE });
    this.y += 32;
  }

  note(text: string, size = 9) {
    for (const line of wrap(text, CONTENT_WIDTH, size)) {
      this.ensure(size + 6);
      this.doc.text(MARGIN, this.y + size, line, { size, color: MUTED });
      this.y += size + 4;
    }
    this.y += 4;
  }

  table(columns: Column[], rows: string[][], boldLastRow = false) {
    const rowHeight = 19;
    const drawHeader = () => {
      this.doc.rect(MARGIN, this.y, CONTENT_WIDTH, rowHeight, { fill: TINT });
      let x = MARGIN;
      for (const column of columns) {
        this.doc.text(column.align === "right" ? x + column.width - 6 : x + 6, this.y + 13, column.header, { size: 8.5, bold: true, color: MUTED, align: column.align });
        x += column.width;
      }
      this.y += rowHeight;
    };
    this.ensure(rowHeight * 2);
    drawHeader();
    rows.forEach((row, index) => {
      if (this.y + rowHeight > BOTTOM) {
        this.doc.addPage();
        this.y = TOP;
        drawHeader(); // the header repeats on every page
      }
      const bold = boldLastRow && index === rows.length - 1;
      let x = MARGIN;
      columns.forEach((column, i) => {
        const text = fitText(row[i] ?? "", column.width - 12, 9, bold);
        this.doc.text(column.align === "right" ? x + column.width - 6 : x + 6, this.y + 13, text, { size: 9, bold, align: column.align });
        x += column.width;
      });
      this.doc.line(MARGIN, this.y + rowHeight, MARGIN + CONTENT_WIDTH, this.y + rowHeight, { color: LINE });
      this.y += rowHeight;
    });
    this.y += 10;
  }
}

export function renderReportPdf(report: ReportData, sections: ReportSections, options: { currency: string; generatedOn: string }): Uint8Array {
  const { currency } = options;
  const doc = new PdfDocument(`Palace Sports performance report, ${report.label}`);
  const layout = new Layout(doc);

  // Title band on the first page
  doc.rect(0, 0, PAGE_WIDTH, 78, { fill: PRIMARY });
  doc.text(MARGIN, 36, "Palace Sports", { size: 20, bold: true, color: "#ffffff" });
  doc.text(MARGIN, 56, "Performance report", { size: 11, color: "#dbe6da" });
  doc.text(PAGE_WIDTH - MARGIN, 56, `Generated ${options.generatedOn}`, { size: 9, color: "#dbe6da", align: "right" });
  layout.y = 100;
  doc.text(MARGIN, layout.y, report.label, { size: 18, bold: true });
  layout.y += 14;
  layout.note("Revenue counts confirmed bookings. Cancelled bookings are left out of every figure.");

  if (report.summary.bookings === 0) {
    layout.y += 10;
    layout.note("There are no bookings in this period.", 11);
  } else {
    if (sections.revenue) revenueSection(layout, report, currency);
    if (sections.pitches) pitchSection(layout, report, currency);
    if (sections.clients) clientSection(layout, report, currency);
    if (sections.utilisation) utilisationSection(layout, report);
    if (!sections.revenue && !sections.pitches && !sections.clients && !sections.utilisation) layout.note("No sections were selected for this report.", 11);
  }

  return doc.save((d, index, total) => {
    d.line(MARGIN, PAGE_HEIGHT - 44, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 44, { color: LINE }, index);
    d.text(MARGIN, PAGE_HEIGHT - 28, `Palace Sports · Performance report · ${report.label}`, { size: 8, color: MUTED }, index);
    d.text(PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 28, `Page ${index + 1} of ${total}`, { size: 8, color: MUTED, align: "right" }, index);
  });
}

function revenueSection(layout: Layout, report: ReportData, currency: string) {
  const { doc } = layout;
  layout.heading("Revenue summary");
  layout.ensure(70);
  const boxes = [
    ["Total revenue", money(report.summary.revenue, currency)],
    ["Bookings", String(report.summary.bookings)],
    ["Average booking", report.summary.averageBooking === null ? "-" : money(report.summary.averageBooking, currency)],
    ["Busiest pitch", report.busiestPitch ?? "-"],
  ];
  const gap = 10;
  const width = (CONTENT_WIDTH - gap * 3) / 4;
  boxes.forEach(([label, value], i) => {
    const x = MARGIN + i * (width + gap);
    doc.rect(x, layout.y, width, 52, { fill: TINT });
    doc.text(x + 10, layout.y + 18, label, { size: 8, color: MUTED });
    doc.text(x + 10, layout.y + 38, fitText(value, width - 20, 13, true), { size: 13, bold: true });
  });
  layout.y += 70;

  // Revenue by month as bars drawn with rectangles
  const chartHeight = 140;
  layout.ensure(chartHeight + 60);
  doc.text(MARGIN, layout.y + 8, "Revenue by month", { size: 10, bold: true });
  layout.y += 22;
  const left = MARGIN + 38;
  const plotWidth = CONTENT_WIDTH - 38;
  const top = layout.y;
  const top100 = niceMax(Math.max(...report.months.map((m) => m.revenue)));
  for (let step = 0; step <= 4; step++) {
    const gridY = top + chartHeight - (step / 4) * chartHeight;
    doc.line(left, gridY, left + plotWidth, gridY, { color: LINE });
    doc.text(left - 6, gridY + 3, short((top100 * step) / 4), { size: 7, color: MUTED, align: "right" });
  }
  const slot = plotWidth / report.months.length;
  const barWidth = Math.min(34, slot * 0.62);
  report.months.forEach((m, i) => {
    const barHeight = (m.revenue / top100) * chartHeight;
    const x = left + i * slot + (slot - barWidth) / 2;
    if (barHeight > 0) {
      doc.rect(x, top + chartHeight - barHeight, barWidth, barHeight, { fill: PRIMARY });
      doc.text(x + barWidth / 2, top + chartHeight - barHeight - 4, short(m.revenue), { size: 7, color: MUTED, align: "center" });
    }
    doc.text(x + barWidth / 2, top + chartHeight + 12, m.name.slice(0, 3), { size: 8, color: MUTED, align: "center" });
  });
  layout.y = top + chartHeight + 28;

  layout.table(
    [
      { header: "Month", width: 205 },
      { header: "Bookings", width: 130, align: "right" },
      { header: "Revenue", width: CONTENT_WIDTH - 335, align: "right" },
    ],
    [
      ...report.months.map((m) => [m.name, String(m.bookings), money(m.revenue, currency)]),
      ["Total", String(report.months.reduce((sum, m) => sum + m.bookings, 0)), money(report.summary.revenue, currency)],
    ],
    true,
  );
}

function pitchSection(layout: Layout, report: ReportData, currency: string) {
  layout.heading("Booking breakdown by pitch");
  const total = report.pitches.reduce((sum, p) => sum + p.revenue, 0);
  layout.table(
    [
      { header: "Pitch", width: 190 },
      { header: "Bookings", width: 80, align: "right" },
      { header: "Hours", width: 70, align: "right" },
      { header: "Revenue", width: 100, align: "right" },
      { header: "Share of revenue", width: CONTENT_WIDTH - 440, align: "right" },
    ],
    [
      ...report.pitches.map((p) => [p.pitch, String(p.bookings), String(p.hours), money(p.revenue, currency), total > 0 ? formatPercentChange(p.revenue / total).replace("+", "") : "-"]),
      ["Total", String(report.pitches.reduce((sum, p) => sum + p.bookings, 0)), String(Math.round(report.pitches.reduce((sum, p) => sum + p.hours, 0) * 100) / 100), money(total, currency), total > 0 ? "100%" : "-"],
    ],
    true,
  );
}

function clientSection(layout: Layout, report: ReportData, currency: string) {
  layout.heading("Top repeat clients");
  if (report.clients.length === 0) return layout.note("No client booked more than once in this period.", 10);
  layout.table(
    [
      { header: "Client", width: 260 },
      { header: "Bookings", width: 110, align: "right" },
      { header: "Revenue", width: CONTENT_WIDTH - 370, align: "right" },
    ],
    report.clients.map((c) => [c.name, String(c.bookings), money(c.revenue, currency)]),
  );
}

function utilisationSection(layout: Layout, report: ReportData) {
  const { doc } = layout;
  const grid = report.utilisation;
  layout.heading("Utilisation overview");
  if (grid.hours.length === 0) return layout.note("No bookings to show busy times for.", 10);
  const cellWidth = 50;
  const cellHeight = 17;
  layout.ensure(cellHeight * (grid.hours.length + 1) + 50);

  // Which weekday and hour was busiest
  let best = { count: 0, day: 0, hour: grid.hours[0] };
  grid.counts.forEach((row, r) => row.forEach((count, day) => count > best.count && (best = { count, day, hour: grid.hours[r] })));
  layout.note(`Busiest time: ${WEEKDAYS_FULL[best.day]} at ${minutesToTime(best.hour * 60)} (${best.count} ${best.count === 1 ? "booking" : "bookings"}). Each square shows how many bookings covered that hour.`);

  const left = MARGIN + 44;
  WEEKDAY_SHORT.forEach((day, i) => doc.text(left + i * cellWidth + cellWidth / 2, layout.y + 10, day, { size: 8, bold: true, color: MUTED, align: "center" }));
  layout.y += 16;
  grid.hours.forEach((hour, r) => {
    doc.text(left - 8, layout.y + r * cellHeight + 12, minutesToTime(hour * 60), { size: 8, color: MUTED, align: "right" });
    grid.counts[r].forEach((count, day) => {
      const intensity = grid.max > 0 ? count / grid.max : 0;
      const x = left + day * cellWidth;
      doc.rect(x + 1, layout.y + r * cellHeight + 1, cellWidth - 2, cellHeight - 2, { fill: count === 0 ? TINT : mix("#dcefdc", PRIMARY, intensity) });
      if (count > 0) doc.text(x + cellWidth / 2, layout.y + r * cellHeight + 12, String(count), { size: 7.5, color: intensity > 0.55 ? "#ffffff" : INK, align: "center" });
    });
  });
  layout.y += grid.hours.length * cellHeight + 12;
}
