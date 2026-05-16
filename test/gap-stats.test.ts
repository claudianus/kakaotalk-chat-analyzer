import assert from "node:assert/strict";
import test from "node:test";
import { GapStreamStats } from "../src/gap-stats.js";

test("GapStreamStats tracks percentiles without storing all gaps", () => {
  const stats = new GapStreamStats();
  const gaps = [5_000, 30_000, 120_000, 600_000, 3_600_000];
  for (const g of gaps) stats.add(g);
  assert.equal(stats.size, 5);
  const median = stats.medianMs();
  const p90 = stats.p90Ms();
  assert.equal(median !== null && median > 0, true);
  assert.equal(p90 !== null && p90 >= median!, true);
  assert.equal(stats.burstUnder1mPercent(), 40);
  assert.equal(stats.coeffVariation() !== null, true);
});
