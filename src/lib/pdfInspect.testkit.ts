// Test helper (not part of the app): reads a PDF back the way a viewer does, through the cross-reference table, and fails if the file is malformed.
import assert from "node:assert/strict";

export const asText = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join("");

export function inspectPdf(bytes: Uint8Array) {
  const text = asText(bytes);
  assert.ok(text.startsWith("%PDF-1.4\n"), "starts like a PDF");
  assert.ok(text.trimEnd().endsWith("%%EOF"), "ends like a PDF");
  const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(text)![1]);
  assert.equal(text.slice(startxref, startxref + 4), "xref", "startxref points at the table");
  const [, count] = /xref\n0 (\d+)\n/.exec(text.slice(startxref))!;
  const rows = [...text.slice(startxref).matchAll(/(\d{10}) (\d{5}) ([nf]) \n/g)];
  assert.equal(rows.length, Number(count));
  rows.slice(1).forEach((row, index) => {
    const n = index + 1;
    assert.equal(text.slice(Number(row[1]), Number(row[1]) + `${n} 0 obj`.length), `${n} 0 obj`, `object ${n} is where the table says`);
  });
  const pages = (text.match(/\/Type \/Page \//g) ?? []).length;
  assert.equal(Number(/\/Count (\d+)/.exec(text)![1]), pages);
  for (const m of text.matchAll(/\/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)) assert.equal(m[2].length, Number(m[1]), "stream length");
  return { text, pages, strings: drawnText(text) };
}

// The PDF's text encoding (WinAnsi) differs from Unicode in a few places we use
const FROM_WIN_ANSI: Record<number, string> = { 0x80: "\u20ac", 0x85: "\u2026", 0x91: "\u2018", 0x92: "\u2019", 0x93: "\u201c", 0x94: "\u201d", 0x95: "\u2022", 0x96: "\u2013", 0x97: "\u2014" };

// Every piece of text drawn on the pages, in order, with the escapes undone and the characters decoded
export function drawnText(pdf: string): string[] {
  const out: string[] = [];
  for (const m of pdf.matchAll(/\(((?:[^()\\]|\\.)*)\) Tj/g)) {
    out.push(
      m[1]
        .replace(/\\([0-7]{3})/g, (_, octal) => {
          const byte = parseInt(octal, 8);
          return FROM_WIN_ANSI[byte] ?? String.fromCharCode(byte);
        })
        .replace(/\\(.)/g, "$1"),
    );
  }
  return out;
}
