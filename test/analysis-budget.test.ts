import assert from "node:assert/strict";
import test from "node:test";
import { analysisBudgetMs } from "../src/analysis-capability.js";
import { AnalysisBudgetTracker, phaseReserveMs } from "../src/analysis-budget.js";

const profile = {
  totalMemGb: 48,
  freeMemGb: 4,
  availableMemGb: 22,
  cpuCores: 10,
  platform: "darwin" as NodeJS.Platform,
  arch: "arm64",
  gpu: "metal" as const,
};

test("analysisBudgetMs uses SLA cap regardless of message count", () => {
  const small = analysisBudgetMs("quality", 1_000, profile);
  const large = analysisBudgetMs("quality", 90_000, profile);
  assert.equal(small, 420_000);
  assert.equal(large, 420_000);
});

test("analysisBudgetMs balanced cap on ample RAM", () => {
  const ms = analysisBudgetMs("balanced", 90_000, profile);
  assert.equal(ms, 360_000);
});

test("phaseReserveMs lowers semantic reserve when headroom is high", () => {
  assert.equal(phaseReserveMs("semantic", "quality", profile), 70_000);
  assert.ok(phaseReserveMs("semantic", "balanced", profile) < 120_000);
});

test("AnalysisBudgetTracker skips when remaining below reserve", () => {
  const lowProfile = {
    totalMemGb: 8,
    freeMemGb: 4,
    availableMemGb: 4,
    cpuCores: 4,
    platform: "darwin" as NodeJS.Platform,
    arch: "arm64",
    gpu: "none" as const,
  };
  const tracker = new AnalysisBudgetTracker("speed", 90_000, lowProfile);
  tracker.remainingMs = () => 5_000;
  assert.equal(tracker.shouldSkip("semantic"), true);
});

test("AnalysisBudgetTracker allows LLM after fast pipeline on balanced", () => {
  const tracker = new AnalysisBudgetTracker("balanced", 20_000, profile);
  tracker.updateLlmSize("4B");
  tracker.remainingMs = () => 330_000;
  assert.equal(tracker.shouldSkip("llm"), false);
});

test("AnalysisBudgetTracker allows semantic at 101s remain on quality+ample RAM", () => {
  const tracker = new AnalysisBudgetTracker("quality", 90_000, profile);
  tracker.remainingMs = () => 101_000;
  assert.equal(tracker.shouldSkip("semantic"), false);
});

test("AnalysisBudgetTracker skips llm_retry when budget exhausted", () => {
  const tracker = new AnalysisBudgetTracker("balanced", 20_000, profile);
  tracker.remainingMs = () => 30_000;
  assert.equal(tracker.shouldSkip("llm_retry"), true);
});

test("phaseReserveMs llm_retry uses 0.8B reserve", () => {
  const ms = phaseReserveMs("llm_retry", "quality", profile);
  assert.ok(ms >= 40_000, `llm_retry reserve should be >=40s, got ${ms}`);
});
