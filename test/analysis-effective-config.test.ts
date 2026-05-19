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
  totalMemGb: 48,
  freeMemGb: 12,
  availableMemGb: 24,
  cpuCores: 8,
  platform: "darwin",
  arch: "arm64",
  gpu: "none",
};

test("resolvePresetSource distinguishes RAM-only vs corpus auto preset", () => {
  assert.equal(resolvePresetSource(undefined, undefined, 125_000, richMachine), "auto-corpus");
  assert.equal(resolvePresetSource(undefined, undefined, 5_000, richMachine), "auto-ram");
});

test("buildAnalysisEffectiveConfig reports auto LLM for balanced on rich RAM", () => {
  const data = emptyReportData();
  data.summary.totalMessages = 125_000;
  data.summary.usedSemanticKeywords = true;
  data.summary.usedLlmAnalysis = false;
  const prev = process.env.KCA_LLM;
  delete process.env.KCA_LLM;
  try {
    const config = buildAnalysisEffectiveConfig(
      data,
      { privacy: "public-masked", top: 40, preset: "balanced" },
      richMachine,
    );
    assert.equal(config.preset, "balanced");
    assert.equal(config.llm.enabled, true);
    assert.equal(config.llm.size, "4B");
    assert.equal(config.llm.used, false);
    assert.ok(config.llm.skippedReason);
    const summary = formatConfigSummaryKo(config);
    assert.match(summary, /preset: balanced/);
    assert.match(summary, /LLM: Qwen3.5-4B/);
  } finally {
    if (prev === undefined) delete process.env.KCA_LLM;
    else process.env.KCA_LLM = prev;
  }
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
