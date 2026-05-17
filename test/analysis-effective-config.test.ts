import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAnalysisEffectiveConfig,
  estimatePresetBeforeParse,
  formatConfigSummaryKo,
  resolvePresetSource,
} from "../src/analysis-effective-config.js";
import type { MachineProfile } from "../src/analysis-capability.js";
import { emptyReportData } from "../src/report-empty.js";

const richMachine: MachineProfile = {
  totalMemGb: 32,
  freeMemGb: 16,
  availableMemGb: 16,
  cpuCores: 8,
  platform: "darwin",
  arch: "arm64",
  gpu: "none",
};

test("resolvePresetSource distinguishes RAM-only vs corpus auto preset", () => {
  assert.equal(resolvePresetSource(undefined, undefined, 95_000, richMachine), "auto-corpus");
  assert.equal(resolvePresetSource(undefined, undefined, 5_000, richMachine), "auto-ram");
});

test("buildAnalysisEffectiveConfig reports LLM off for balanced preset", () => {
  const data = emptyReportData();
  data.summary.totalMessages = 90_000;
  data.summary.usedSemanticKeywords = true;
  data.summary.usedLlmAnalysis = false;
  const config = buildAnalysisEffectiveConfig(
    data,
    { privacy: "public-masked", top: 40, preset: undefined },
    richMachine,
  );
  assert.equal(config.preset, "balanced");
  assert.equal(config.llm.tier, "off");
  assert.equal(config.llm.used, false);
  assert.ok(config.llm.skippedReason?.includes("balanced"));
  const summary = formatConfigSummaryKo(config);
  assert.match(summary, /preset: balanced/);
  assert.match(summary, /LLM: tier off/);
});

test("resolvePresetSource detects CLI preset", () => {
  assert.equal(resolvePresetSource("quality", undefined, 10_000, richMachine), "cli");
});

test("resolvePresetSource prefers env preset over legacy fast worker", () => {
  const prev = process.env.KCA_PRESET;
  process.env.KCA_PRESET = "balanced";
  try {
    assert.equal(resolvePresetSource(undefined, true, 10_000, richMachine), "env");
  } finally {
    if (prev === undefined) delete process.env.KCA_PRESET;
    else process.env.KCA_PRESET = prev;
  }
});
