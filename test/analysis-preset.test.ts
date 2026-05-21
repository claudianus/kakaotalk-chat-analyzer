import assert from "node:assert/strict";
import test from "node:test";
import {
  autoPresetFromMachine,
  getPresetEffectiveFlags,
  presetForcesSentimentOff,
  resolvePresetName,
} from "../src/analysis-preset.js";
import type { MachineProfile } from "../src/analysis-capability.js";

const richMachine: MachineProfile = {
  totalMemGb: 32,
  freeMemGb: 16,
  availableMemGb: 16,
  cpuCores: 8,
  platform: "darwin",
  arch: "arm64",
  gpu: "none",
};

const lowMem: MachineProfile = {
  totalMemGb: 8,
  freeMemGb: 4,
  availableMemGb: 4,
  cpuCores: 4,
  platform: "darwin",
  arch: "arm64",
  gpu: "none",
};

/** macOS: freemem 과소, 가용은 충분 */
const macCachedMemory: MachineProfile = {
  totalMemGb: 48,
  freeMemGb: 5.5,
  availableMemGb: 18,
  cpuCores: 10,
  platform: "darwin",
  arch: "arm64",
  gpu: "metal",
};

test("autoPresetFromMachine picks speed on low RAM", () => {
  assert.equal(autoPresetFromMachine(lowMem, 5_000), "speed");
});

test("autoPresetFromMachine picks quality on 16GB and small corpus", () => {
  assert.equal(autoPresetFromMachine(richMachine, 10_000), "quality");
});

const ultraMachine: MachineProfile = {
  totalMemGb: 48,
  freeMemGb: 12,
  availableMemGb: 20,
  cpuCores: 10,
  platform: "darwin",
  arch: "arm64",
  gpu: "none",
};

test("autoPresetFromMachine picks ultra when RAM headroom >= 18GB", () => {
  assert.equal(autoPresetFromMachine(ultraMachine, 50_000), "ultra");
  // 48GB+ & headroom >= 20 → 메시지 수 무관 ultra
  assert.equal(autoPresetFromMachine(ultraMachine, 95_000), "ultra");
  assert.equal(autoPresetFromMachine(ultraMachine, 135_000), "ultra");
});

test("autoPresetFromMachine picks quality on 32GB until very large corpus", () => {
  assert.equal(autoPresetFromMachine(richMachine, 90_000), "quality");
  assert.equal(autoPresetFromMachine(richMachine, 125_000), "balanced");
});

test("autoPresetFromMachine uses available not free on macOS cache", () => {
  // 48GB+ & headroom=18 >= 14 → ultra (n < 150k), quality (n >= 150k)
  assert.equal(autoPresetFromMachine(macCachedMemory, 90_000), "ultra");
  assert.equal(autoPresetFromMachine(macCachedMemory, 10_000), "ultra");
  assert.equal(autoPresetFromMachine(macCachedMemory, 125_000), "ultra");
  assert.equal(autoPresetFromMachine(macCachedMemory, 160_000), "quality");
});

test("getPresetEffectiveFlags maps balanced semantic cap and auto LLM", () => {
  const prev = process.env.KCA_LLM;
  delete process.env.KCA_LLM;
  try {
    const flags = getPresetEffectiveFlags({ preset: "balanced" });
    assert.ok(flags.semanticCap === 600 || flags.semanticCap === 900);
    assert.equal(flags.llmEnabled, true);
  } finally {
    if (prev === undefined) delete process.env.KCA_LLM;
    else process.env.KCA_LLM = prev;
  }
});

test("getPresetEffectiveFlags ultra semantic cap scales with RAM", () => {
  const flags = getPresetEffectiveFlags({ preset: "ultra" });
  assert.equal(flags.preset, "ultra");
  assert.ok(flags.semanticCap === 1500 || flags.semanticCap === 1800);
});

test("presetForcesSentimentOff blocks speed; quality and ultra are never forced off", () => {
  assert.equal(presetForcesSentimentOff({ preset: "speed" }), true);
  assert.equal(presetForcesSentimentOff({ preset: "quality" }), false);
  assert.equal(presetForcesSentimentOff({ preset: "ultra" }), false);
});

test("resolvePresetName maps --fast legacy to speed via worker", () => {
  assert.equal(resolvePresetName({ worker: true }), "speed");
});
