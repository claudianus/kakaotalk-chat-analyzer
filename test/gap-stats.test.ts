import assert from "node:assert/strict";
import test from "node:test";
import { GapStreamStats } from "../src/gap-stats.js";

test("Welford variance matches manual calculation for known sequence", () => {
  const stats = new GapStreamStats();
  // Mean = 3000, sample variance = (sum of squared deviations) / (n-1) = 10_000_000 / 4 = 2_500_000
  // CV = sqrt(2_500_000) / 3000 ≈ 1581.14 / 3000 ≈ 0.53
  const gaps = [1000, 2000, 3000, 4000, 5000];
  for (const g of gaps) stats.add(g);
  const cv = stats.coeffVariation();
  assert.equal(cv !== null, true, "CV should not be null for 5 data points");
  // sample stddev ≈ 1581.14, CV ≈ 1581.14/3000 ≈ 0.53
  assert.ok(cv! >= 0.50 && cv! <= 0.56, `CV should be ~0.53, got ${cv}`);
});

test("coeffVariation returns null for fewer than 2 data points", () => {
  const stats = new GapStreamStats();
  assert.equal(stats.coeffVariation(), null);
  stats.add(5000);
  assert.equal(stats.coeffVariation(), null);
});

test("coeffVariation returns null when variance is zero (all gaps identical)", () => {
  const stats = new GapStreamStats();
  stats.add(5000);
  stats.add(5000);
  // welfordM2 should be exactly 0 for identical values
  const cv = stats.coeffVariation();
  assert.equal(cv, null, "CV should be null when M2 <= 0 (identical values)");
});

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
  assert.equal(median, 10_000);
});
