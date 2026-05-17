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
  cpuCores: 8,
  platform: "darwin",
  arch: "arm64",
  gpu: "none",
};

const lowMem: MachineProfile = {
  totalMemGb: 8,
  freeMemGb: 4,
  cpuCores: 4,
  platform: "darwin",
  arch: "arm64",
  gpu: "none",
};

test("autoPresetFromMachine picks speed on low RAM", () => {
  assert.equal(autoPresetFromMachine(lowMem, 5_000), "speed");
});

test("autoPresetFromMachine picks quality on 16GB and small corpus", () => {
  assert.equal(autoPresetFromMachine(richMachine, 10_000), "quality");
});

test("autoPresetFromMachine picks balanced on 16GB and 30k+ messages", () => {
  assert.equal(autoPresetFromMachine(richMachine, 90_000), "balanced");
});

test("getPresetEffectiveFlags maps balanced semantic cap", () => {
  const flags = getPresetEffectiveFlags({ preset: "balanced" });
  assert.equal(flags.semanticCap, 600);
  assert.equal(flags.llmEnabled, false);
});

test("presetForcesSentimentOff for balanced preset", () => {
  assert.equal(presetForcesSentimentOff({ preset: "balanced" }), true);
  assert.equal(presetForcesSentimentOff({ preset: "quality" }), false);
});

test("resolvePresetName maps --fast legacy to speed via worker", () => {
  assert.equal(resolvePresetName({ worker: true }), "speed");
});
