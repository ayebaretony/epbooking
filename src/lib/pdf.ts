// A small, dependency-free PDF writer: A4 pages, the two standard fonts every PDF viewer has (Helvetica and Helvetica Bold),
// text, lines and rectangles. That is enough for reports with tables and simple charts. Written instead of adding a large
// PDF library. The standard fonts cover Western characters only: anything else is drawn as "?".
//
// Coordinates are in points (1/72 inch) measured from the TOP-LEFT of the page, which is how people lay out a page.

export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;

// Character widths (in 1/1000 of the font size) for the characters from space (32) to ~ (126), from the Helvetica metrics
const REGULAR_WIDTHS = "278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 278 278 584 584 584 556 1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 667 778 722 667 611 722 667 944 667 667 611 278 278 278 469 556 333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 556 556 333 500 278 556 500 722 500 500 500 334 260 334 584".split(" ").map(Number);
const BOLD_WIDTHS = "278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 333 333 584 584 584 611 975 722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 667 778 722 667 611 722 667 944 667 667 611 333 278 333 584 556 333 556 611 556 611 556 333 611 611 278 278 556 278 889 611 611 611 611 389 556 333 611 556 778 556 556 500 389 280 389 584".split(" ").map(Number);

// The few non-ASCII characters we use, in the PDF's text encoding (WinAnsi)
const WIN_ANSI: Record<number, number> = { 0x20ac: 0x80, 0x2026: 0x85, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97 };

// One character as a byte of the PDF's text encoding, or "?" when the standard fonts cannot draw it
function encodeChar(char: string): number {
  const code = char.codePointAt(0) ?? 63;
  if (code === 0xa0) return 32; // a non-breaking space is just a space here
  if (code >= 32 && code <= 126) return code;
  if (code >= 0xa1 && code <= 0xff) return code;
  return WIN_ANSI[code] ?? 63;
}

export function textWidth(text: string, size: number, bold = false): number {
  const table = bold ? BOLD_WIDTHS : REGULAR_WIDTHS;
  let units = 0;
  for (const char of text) {
    const byte = encodeChar(char);
    units += byte >= 32 && byte <= 126 ? table[byte - 32] : 556;
  }
  return (units * size) / 1000;
}

// Shortens text with an ellipsis so it fits in `maxWidth`
export function fitText(text: string, maxWidth: number, size: number, bold = false): string {
  if (textWidth(text, size, bold) <= maxWidth) return text;
  const ellipsis = "...";
  let out = text;
  while (out.length > 0 && textWidth(out + ellipsis, size, bold) > maxWidth) out = out.slice(0, -1);
  return out.trimEnd() + ellipsis;
}

// A text string as PDF source: (…) with the characters that matter escaped
function pdfString(text: string): string {
  let out = "(";
  for (const char of text) {
    const byte = encodeChar(char);
    if (char === "\\" || char === "(" || char === ")") out += `\\${char}`;
    else if (byte >= 32 && byte <= 126) out += String.fromCharCode(byte);
    else out += `\\${byte.toString(8).padStart(3, "0")}`;
  }
  return out + ")";
}

// "#245521" -> "0.141 0.333 0.129"
function rgb(hex: string): string {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((at) => (parseInt(value.slice(at, at + 2), 16) / 255).toFixed(3)).join(" ");
}

const num = (value: number) => (Math.round(value * 100) / 100).toString();

export type TextOptions = { size?: number; bold?: boolean; color?: string; align?: "left" | "right" | "center" };
export type RectOptions = { fill?: string; stroke?: string; lineWidth?: number };
export type LineOptions = { color?: string; width?: number };

export class PdfDocument {
  private readonly pages: string[][] = [];
  private readonly title: string;

  constructor(title: string) {
    this.title = title;
    this.addPage();
  }

  get pageCount(): number {
    return this.pages.length;
  }

  addPage(): void {
    this.pages.push([]);
  }

  private ops(page?: number): string[] {
    return this.pages[page ?? this.pages.length - 1];
  }

  // Draws text with its baseline at y. Alignment is relative to x (the left edge, the right edge, or the middle).
  text(x: number, y: number, text: string, options: TextOptions = {}, page?: number): void {
    const { size = 10, bold = false, color = "#121a14", align = "left" } = options;
    const width = textWidth(text, size, bold);
    const left = align === "right" ? x - width : align === "center" ? x - width / 2 : x;
    this.ops(page).push(`BT /${bold ? "F2" : "F1"} ${num(size)} Tf ${rgb(color)} rg ${num(left)} ${num(PAGE_HEIGHT - y)} Td ${pdfString(text)} Tj ET`);
  }

  rect(x: number, y: number, width: number, height: number, options: RectOptions = {}, page?: number): void {
    const { fill, stroke, lineWidth = 0.5 } = options;
    const parts = [`q ${num(lineWidth)} w`];
    if (fill) parts.push(`${rgb(fill)} rg`);
    if (stroke) parts.push(`${rgb(stroke)} RG`);
    parts.push(`${num(x)} ${num(PAGE_HEIGHT - y - height)} ${num(width)} ${num(height)} re ${fill && stroke ? "B" : fill ? "f" : "S"} Q`);
    this.ops(page).push(parts.join(" "));
  }

  line(x1: number, y1: number, x2: number, y2: number, options: LineOptions = {}, page?: number): void {
    const { color = "#dce5da", width = 0.5 } = options;
    this.ops(page).push(`q ${num(width)} w ${rgb(color)} RG ${num(x1)} ${num(PAGE_HEIGHT - y1)} m ${num(x2)} ${num(PAGE_HEIGHT - y2)} l S Q`);
  }

  // Finishes the file. `decorate` runs once per page after everything else is drawn, so it can add "Page 2 of 5" footers.
  save(decorate?: (doc: PdfDocument, pageIndex: number, pageTotal: number) => void, createdAt: Date = new Date()): Uint8Array {
    if (decorate) this.pages.forEach((_, index) => decorate(this, index, this.pages.length));

    // Objects: 1 catalog, 2 page list, 3 and 4 fonts, 5 info, then a page and its content for each page
    const objects: string[] = [];
    const pageObjectNumber = (index: number) => 6 + index * 2;
    const kids = this.pages.map((_, index) => `${pageObjectNumber(index)} 0 R`).join(" ");
    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${this.pages.length} >>`;
    objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `D:${createdAt.getFullYear()}${pad(createdAt.getMonth() + 1)}${pad(createdAt.getDate())}${pad(createdAt.getHours())}${pad(createdAt.getMinutes())}${pad(createdAt.getSeconds())}`;
    objects[5] = `<< /Title ${pdfString(this.title)} /Creator ${pdfString("Palace Sports")} /Producer ${pdfString("Palace Sports booking system")} /CreationDate (${stamp}) >>`;
    this.pages.forEach((ops, index) => {
      const content = ops.join("\n");
      objects[pageObjectNumber(index)] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageObjectNumber(index) + 1} 0 R >>`;
      objects[pageObjectNumber(index) + 1] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
    });

    // Every character is 0-255 here, so one character is one byte and offsets can be counted on the string
    let file = "%PDF-1.4\n%âãÏÓ\n";
    const offsets: number[] = [];
    for (let n = 1; n < objects.length; n++) {
      offsets[n] = file.length;
      file += `${n} 0 obj\n${objects[n]}\nendobj\n`;
    }
    const xrefAt = file.length;
    file += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let n = 1; n < objects.length; n++) file += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
    file += `trailer\n<< /Size ${objects.length} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;

    const bytes = new Uint8Array(file.length);
    for (let i = 0; i < file.length; i++) bytes[i] = file.charCodeAt(i) & 0xff;
    return bytes;
  }
}
