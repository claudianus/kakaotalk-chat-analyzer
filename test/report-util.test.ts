import assert from "node:assert/strict";
import test from "node:test";
import { formatCompactNumber, formatNumber } from "../src/report-util.js";

test("formatNumber uses Korean grouping", () => {
  assert.equal(formatNumber(446_166), "446,166");
});

test("formatCompactNumber uses 만·억 not k/M", () => {
  assert.equal(formatCompactNumber(446_166), "44.6만");
  assert.equal(formatCompactNumber(12_000), "1.2만");
  assert.equal(formatCompactNumber(5_000), "5,000");
  assert.equal(formatCompactNumber(120_000_000), "1.2억");
  assert.ok(!/[kM]/i.test(formatCompactNumber(99_999)));
});
