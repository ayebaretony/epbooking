import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { test } from "node:test";
import { buildXlsx, columnName, crc32, sheetNames, zipStore } from "./xlsx.ts";

const decoder = new TextDecoder();

// A tiny zip READER for the tests, so the file is checked from the outside by reading it back the way Excel would
function readZip(bytes: Uint8Array): Map<string, { text: string; crcOk: boolean }> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--;
  assert.ok(end >= 0, "no end-of-zip marker");
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files = new Map<string, { text: string; crcOk: boolean }>();
  for (let i = 0; i < count; i++) {
    assert.equal(view.getUint32(at, true), 0x02014b50);
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const offset = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    assert.equal(view.getUint32(offset, true), 0x04034b50);
    const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
    const raw = bytes.subarray(start, start + size);
    const data = method === 8 ? new Uint8Array(inflateRawSync(raw)) : raw;
    files.set(name, { text: decoder.decode(data), crcOk: crc32(data) === crc });
    at += 46 + nameLength;
  }
  return files;
}

test("crc32 matches the standard check value", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  assert.equal(crc32(new Uint8Array()), 0);
});

test("a zip reads back with every file intact", () => {
  const zip = zipStore([{ name: "a.txt", data: new TextEncoder().encode("hello") }, { name: "folder/ü.txt", data: new TextEncoder().encode("wörld") }]);
  const files = readZip(zip);
  assert.deepEqual([...files.keys()], ["a.txt", "folder/ü.txt"]);
  assert.equal(files.get("a.txt")!.text, "hello");
  assert.equal(files.get("folder/ü.txt")!.text, "wörld");
  assert.ok([...files.values()].every((f) => f.crcOk));
});

test("column letters, and sheet names Excel will accept", () => {
  assert.deepEqual([0, 1, 25, 26, 27, 701, 702].map(columnName), ["A", "B", "Z", "AA", "AB", "ZZ", "AAA"]);
  assert.deepEqual(sheetNames(["Summary", "summary", "Bookings: 2026/27?", "x".repeat(40)]), ["Summary", "summary 2", "Bookings- 2026-27-", "x".repeat(31)]);
});

test("a workbook has every part Excel needs, with values, styles and escaped text", () => {
  const file = buildXlsx([
    { name: "Summary", columnWidths: [24, 14], rows: [[{ value: "Palace & Sons <FC>", style: "title" }], [{ value: "Revenue", style: "header" }, { value: "Amount", style: "header" }], ["Total", { value: 1234.5, style: "money" }], ["Bookings", { value: 12, style: "integer" }], ["Empty", null], ["  padded  ", 7]] },
    { name: "By month", rows: [["January", 1]] },
  ]);
  const files = readZip(file);
  assert.deepEqual([...files.keys()], ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]);
  assert.ok([...files.values()].every((f) => f.crcOk));
  const sheet = files.get("xl/worksheets/sheet1.xml")!.text;
  assert.match(sheet, /<c r="A1" s="4" t="inlineStr"><is><t xml:space="preserve">Palace &amp; Sons &lt;FC&gt;<\/t><\/is><\/c>/);
  assert.match(sheet, /<c r="B3" s="2"><v>1234.5<\/v><\/c>/); // a real number, so Excel can add it up
  assert.match(sheet, /<c r="B4" s="3"><v>12<\/v><\/c>/);
  assert.match(sheet, /<t xml:space="preserve"> {2}padded {2}<\/t>/); // spaces are kept
  assert.doesNotMatch(sheet, /r="B5"/); // an empty cell with no style writes nothing
  assert.match(sheet, /<cols><col min="1" max="1" width="24" customWidth="1"\/>/);
  assert.match(files.get("xl/workbook.xml")!.text, /<sheet name="Summary" sheetId="1" r:id="rId1"\/><sheet name="By month" sheetId="2" r:id="rId2"\/>/);
  assert.match(files.get("[Content_Types].xml")!.text, /worksheets\/sheet2\.xml/);
});

test("characters XML cannot hold are removed, and numbers that are not real numbers become empty cells", () => {
  const files = readZip(buildXlsx([{ name: "S", rows: [["bad\u0000\u0007char", Number.NaN, Number.POSITIVE_INFINITY, "ok"]] }]));
  const sheet = files.get("xl/worksheets/sheet1.xml")!.text;
  assert.match(sheet, /<t xml:space="preserve">badchar<\/t>/);
  assert.doesNotMatch(sheet, /NaN|Infinity/);
  assert.match(sheet, /r="D1"/);
});

test("a workbook with no sheets still opens (one empty sheet)", () => {
  const files = readZip(buildXlsx([]));
  assert.match(files.get("xl/workbook.xml")!.text, /<sheet name="Sheet1"/);
});
