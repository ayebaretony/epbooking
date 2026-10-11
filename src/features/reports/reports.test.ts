import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectPdf } from "../../lib/pdfInspect.testkit.ts";
import { buildReport } from "../../lib/report.ts";
import type { Booking } from "../../types/models.ts";
import { reportSheets } from "./reportXlsx.ts";
import { renderReportPdf, type ReportSections } from "./reportPdf.ts";

let n = 0;
const b = (date: string, total: number, overrides: Partial<Booking> = {}): Booking => ({
  id: `p${n++}`, pitch: "Fifa Pitch", clientName: "Test Client", contact: "0500000000", date, startTime: "18:00", endTime: "19:00", pricePerHour: total, hours: 1, totalPayment: total, ...overrides,
});
const sample = [
  b("2026-01-10", 1000, { clientName: "Juventus", hours: 2, endTime: "20:00" }),
  b("2026-01-17", 500, { clientName: "Juventus" }),
  b("2026-02-03", 300, { pitch: "Airdome", clientName: "Solo & Sons (FC)", hours: 1.5, endTime: "19:30" }),
  b("2026-02-05", 120, { pitch: "Airdome", clientName: "Pending Person", status: "pending" }),
];
const pitches = ["Fifa Pitch", "Airdome", "Half Pitch"];
const all: ReportSections = { revenue: true, pitches: true, clients: true, utilisation: true };
const report = buildReport(sample, { year: 2026, fromMonth: 0, toMonth: 1 }, pitches);
const options = { currency: "AED", generatedOn: "11 Oct 2026" };

test("the PDF is valid and carries the period, the numbers and every selected section", () => {
  const { strings, pages } = inspectPdf(renderReportPdf(report, all, options));
  assert.ok(pages >= 1);
  for (const expected of ["Palace Sports", "Performance report", "January – February 2026".replace("–", "–"), "Revenue summary", "Booking breakdown by pitch", "Top repeat clients", "Utilisation overview"]) {
    assert.ok(strings.some((s) => s.includes(expected)), `missing "${expected}"`);
  }
  assert.ok(strings.includes("AED 1,800")); // total revenue (the pending 120 is not revenue)
  assert.ok(strings.includes("Juventus") && strings.includes("Fifa Pitch"));
  assert.ok(strings.includes("Solo & Sons (FC)") === false); // a one-off client is not a repeat client
  assert.ok(strings.some((s) => s.startsWith("Page 1 of ")));
});

test("only the ticked sections appear", () => {
  const { strings } = inspectPdf(renderReportPdf(report, { revenue: false, pitches: true, clients: false, utilisation: false }, options));
  assert.ok(strings.includes("Booking breakdown by pitch"));
  assert.ok(!strings.includes("Revenue summary") && !strings.includes("Top repeat clients") && !strings.includes("Utilisation overview"));
  const none = inspectPdf(renderReportPdf(report, { revenue: false, pitches: false, clients: false, utilisation: false }, options));
  assert.ok(none.strings.some((s) => s.includes("No sections were selected")));
});

test("a period with no bookings gives a short, valid PDF that says so", () => {
  const empty = buildReport(sample, { year: 2024, fromMonth: 0, toMonth: 11 }, pitches);
  const { strings, pages } = inspectPdf(renderReportPdf(empty, all, options));
  assert.equal(pages, 1);
  assert.ok(strings.includes("There are no bookings in this period."));
  assert.ok(!strings.includes("Revenue summary"));
});

test("a long report flows onto more pages, repeats table headers, and numbers every page", () => {
  const many = Array.from({ length: 80 }, (_, i) => `Pitch number ${i + 1}`);
  const big = buildReport(sample, { year: 2026, fromMonth: 0, toMonth: 1 }, many);
  const { strings, pages } = inspectPdf(renderReportPdf(big, all, options));
  assert.ok(pages >= 3, `expected several pages, got ${pages}`);
  assert.ok(strings.filter((s) => s === "Share of revenue").length >= 2); // the header came back on the next page
  for (let page = 1; page <= pages; page++) assert.ok(strings.includes(`Page ${page} of ${pages}`));
});

test("the Excel report has a summary, the ticked sections and the full booking list", () => {
  const sheets = reportSheets(report, all, "11 Oct 2026");
  assert.deepEqual(sheets.map((s) => s.name), ["Summary", "By month", "By pitch", "Top clients", "Busy times", "Bookings"]);
  const summary = sheets[0].rows;
  assert.deepEqual(summary[1], ["Period", "January – February 2026"]);
  assert.deepEqual(summary[6], ["Total revenue (AED)", { value: 1800, style: "money" }]);
  const bookings = sheets.at(-1)!.rows;
  assert.equal(bookings.length, 1 + 4); // header + every non-cancelled booking
  assert.deepEqual(bookings[1].slice(0, 5), ["2026-01-10", "18:00", "20:00", "Fifa Pitch", "Juventus"]);
  assert.equal((bookings[4] as unknown[])[9], "Pending");
  const byPitch = sheets[2].rows;
  assert.deepEqual(byPitch[1].slice(0, 3), ["Fifa Pitch", { value: 2, style: "integer" }, 3]);
});

test("unticked sections are left out of the Excel report, but the summary and booking list always stay", () => {
  const sheets = reportSheets(report, { revenue: false, pitches: false, clients: true, utilisation: false }, "11 Oct 2026");
  assert.deepEqual(sheets.map((s) => s.name), ["Summary", "Top clients", "Bookings"]);
});
