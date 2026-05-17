import assert from "node:assert/strict";
import test from "node:test";
import { analysisBudgetMs } from "../src/analysis-capability.js";
import { AnalysisBudgetTracker } from "../src/analysis-budget.js";

test("analysisBudgetMs caps balanced at 5min for large corpus", () => {
  const profile = {
    totalMemGb: 16,
    freeMemGb: 8,
    cpuCores: 8,
    platform: "darwin" as NodeJS.Platform,
    arch: "arm64",
    gpu: "none" as const,
  };
  const ms = analysisBudgetMs("balanced", 90_000, profile);
  assert.ok(ms <= 300_000);
  assert.ok(ms > 60_000);
});

test("AnalysisBudgetTracker skips when remaining below reserve", () => {
  const profile = {
    totalMemGb: 16,
    freeMemGb: 8,
    cpuCores: 8,
    platform: "darwin" as NodeJS.Platform,
    arch: "arm64",
    gpu: "none" as const,
  };
  const tracker = new AnalysisBudgetTracker("speed", 90_000, profile);
  tracker.remainingMs = () => 5_000;
  assert.equal(tracker.shouldSkip("semantic"), true);
});
