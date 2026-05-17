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

test("GapStreamStats uses exact quantiles at large sample sizes", () => {
  const stats = new GapStreamStats();
  for (let i = 0; i < 50_001; i += 1) {
    stats.add(i % 2 === 0 ? 10_000 : 20_000);
  }
  assert.equal(stats.size, 50_001);
  const median = stats.medianMs();
  assert.equal(median !== null && median >= 9_000 && median <= 21_000, true);
});
