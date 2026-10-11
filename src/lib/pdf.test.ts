import assert from "node:assert/strict";
import { test } from "node:test";
import { PAGE_HEIGHT, PdfDocument, fitText, textWidth } from "./pdf.ts";
import { asText, inspectPdf as inspect } from "./pdfInspect.testkit.ts";

test("text widths come from the font metrics", () => {
  assert.equal(textWidth("", 10), 0);
  assert.ok(textWidth("iiii", 10) < textWidth("WWWW", 10));
  assert.equal(textWidth("0", 10), 5.56);
  assert.ok(textWidth("Hello", 10, true) > textWidth("Hello", 10)); // bold is wider
  assert.equal(textWidth("a", 20), 2 * textWidth("a", 10));
});

test("long text is shortened to fit, short text is left alone", () => {
  assert.equal(fitText("Short", 200, 10), "Short");
  const fitted = fitText("A very long client name that cannot possibly fit", 80, 10);
  assert.ok(fitted.endsWith("...") && textWidth(fitted, 10) <= 80);
});

test("a document is a valid PDF: header, correct cross-reference table, page count, stream lengths", () => {
  const doc = new PdfDocument("Test report");
  doc.text(40, 60, "Hello world", { size: 14, bold: true });
  doc.rect(40, 80, 100, 20, { fill: "#245521" });
  doc.line(40, 110, 200, 110);
  doc.addPage();
  doc.text(40, 60, "Second page");
  const { text, pages } = inspect(doc.save());
  assert.equal(pages, 2);
  assert.ok(text.includes("/BaseFont /Helvetica-Bold"));
  assert.ok(text.includes("/Title (Test report)"));
  assert.ok(text.includes("(Hello world) Tj") && text.includes("(Second page) Tj"));
  assert.ok(text.includes(`40 ${Math.round((PAGE_HEIGHT - 60) * 100) / 100} Td`)); // y is measured from the top of the page
});

test("special characters are escaped, and ones the fonts cannot draw become ?", () => {
  const doc = new PdfDocument("x");
  doc.text(10, 10, "Tom (and) Jerry \\ co");
  doc.text(10, 30, "Café – AED 5");
  doc.text(10, 50, "مرحبا");
  const { text } = inspect(doc.save());
  assert.ok(text.includes("(Tom \\(and\\) Jerry \\\\ co) Tj"));
  assert.ok(text.includes("(Caf\\351 \\226 AED 5) Tj")); // é, en dash and a plain space for the non-breaking one
  assert.ok(text.includes("(?????) Tj"));
});

test("right and centred text are placed using the real width", () => {
  const doc = new PdfDocument("x");
  doc.text(100, 20, "abc", { size: 10, align: "right" });
  doc.text(100, 40, "abc", { size: 10, align: "center" });
  const text = asText(doc.save());
  const w = textWidth("abc", 10);
  assert.ok(text.includes(`${Math.round((100 - w) * 100) / 100} ${Math.round((PAGE_HEIGHT - 20) * 100) / 100} Td`));
  assert.ok(text.includes(`${Math.round((100 - w / 2) * 100) / 100} ${Math.round((PAGE_HEIGHT - 40) * 100) / 100} Td`));
});

test("a footer callback runs once per page, knowing the page number and the total", () => {
  const doc = new PdfDocument("x");
  doc.addPage();
  doc.addPage();
  const seen: string[] = [];
  const { text } = inspect(doc.save((d, index, total) => { seen.push(`${index + 1}/${total}`); d.text(10, 10, `Page ${index + 1} of ${total}`, {}, index); }));
  assert.deepEqual(seen, ["1/3", "2/3", "3/3"]);
  assert.ok(text.includes("(Page 3 of 3) Tj"));
});
