import assert from "node:assert/strict";
import test from "node:test";
import type { MachineProfile } from "../src/analysis-capability.js";
import {
  memoryHeadroomForLlmLoad,
  pickLargestQwen35ForRam,
  resolveLlmRunPlan,
} from "../src/llm-resolve.js";
import { parseQwen35Size } from "../src/llm-qwen35.js";
import { ggufPathForSize } from "../src/llm-cache.js";

function profile(availableMemGb: number, freeMemGb = availableMemGb): MachineProfile {
  return {
    totalMemGb: availableMemGb + 4,
    freeMemGb,
    availableMemGb,
    cpuCores: 8,
    platform: "darwin",
    arch: "arm64",
    gpu: "none",
  };
}

test("memoryHeadroomForLlmLoad uses free when available >> free", () => {
  const p = profile(23.1, 3.5);
  assert.equal(memoryHeadroomForLlmLoad(p), 3.5);
  assert.equal(pickLargestQwen35ForRam(memoryHeadroomForLlmLoad(p)), "0.8B");
});

test("resolveLlmRunPlan auto picks 0.8B when free RAM low after heavy analysis", () => {
  const plan = resolveLlmRunPlan({ preset: "balanced", profile: profile(23.1, 3.5) });
  assert.equal(plan.enabled, true);
  assert.equal(plan.size, "0.8B");
  assert.match(plan.reason, /로드 3\.5GB/);
});

test("pickLargestQwen35ForRam greedy max", () => {
  assert.equal(pickLargestQwen35ForRam(28), "9B");
  assert.equal(pickLargestQwen35ForRam(10), "4B");
  assert.equal(pickLargestQwen35ForRam(7), "2B");
  assert.equal(pickLargestQwen35ForRam(3), "0.8B");
  assert.equal(pickLargestQwen35ForRam(2), undefined);
});

test("resolveLlmRunPlan auto picks 9B on 28GB quality", () => {
  const plan = resolveLlmRunPlan({ preset: "quality", profile: profile(28) });
  assert.equal(plan.enabled, true);
  assert.equal(plan.size, "9B");
  assert.match(plan.reason, /자동 최대/);
});

test("resolveLlmRunPlan off below minimum RAM", () => {
  const plan = resolveLlmRunPlan({ preset: "balanced", profile: profile(2) });
  assert.equal(plan.enabled, false);
  assert.match(plan.reason, /3GB/);
});

test("resolveLlmRunPlan 7GB picks 2B", () => {
  const plan = resolveLlmRunPlan({ preset: "balanced", profile: profile(7) });
  assert.equal(plan.enabled, true);
  assert.equal(plan.size, "2B");
});

test("legacy KCA_LLM_MODEL=8b maps to 9B", () => {
  const prev = process.env.KCA_LLM_MODEL;
  process.env.KCA_LLM_MODEL = "8b";
  try {
    const plan = resolveLlmRunPlan({ preset: "quality", profile: profile(28) });
    assert.equal(plan.size, "9B");
    assert.match(plan.reason, /KCA_LLM_MODEL/);
  } finally {
    if (prev === undefined) delete process.env.KCA_LLM_MODEL;
    else process.env.KCA_LLM_MODEL = prev;
  }
});

test("speed and balanced presets enable LLM when RAM allows", () => {
  const p = profile(28);
  for (const preset of ["speed", "balanced", "quality"] as const) {
    const plan = resolveLlmRunPlan({ preset, profile: p });
    assert.equal(plan.enabled, true, preset);
    assert.equal(plan.size, "9B", preset);
  }
});

test("KCA_LLM=0 disables all presets", () => {
  const prev = process.env.KCA_LLM;
  process.env.KCA_LLM = "0";
  try {
    const plan = resolveLlmRunPlan({ preset: "quality", profile: profile(28) });
    assert.equal(plan.enabled, false);
    assert.equal(plan.reason, "KCA_LLM=0");
  } finally {
    if (prev === undefined) delete process.env.KCA_LLM;
    else process.env.KCA_LLM = prev;
  }
});

test("parseQwen35Size and gguf paths use size folders", () => {
  assert.equal(parseQwen35Size("qwen3.5-4b"), "4B");
  assert.equal(parseQwen35Size("9B"), "9B");
  assert.ok(ggufPathForSize("9B").includes("/9B/"));
});
