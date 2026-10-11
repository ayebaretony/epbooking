import assert from "node:assert/strict";
import { test } from "node:test";
import { reportFileName } from "./reportFiles.ts";

test("file names are safe and readable", () => {
  assert.equal(reportFileName("January – October 2026", "pdf"), "Palace-Sports-Report-January-October-2026.pdf");
  assert.equal(reportFileName("May 2026", "xlsx"), "Palace-Sports-Report-May-2026.xlsx");
  assert.equal(reportFileName("///", "pdf"), "Palace-Sports-Report-report.pdf");
});
