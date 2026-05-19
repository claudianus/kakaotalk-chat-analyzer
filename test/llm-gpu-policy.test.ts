import assert from "node:assert/strict";
import test from "node:test";
import { resolveLlmGpuForInfer } from "../src/llm-gpu-policy.js";
import type { MachineProfile } from "../src/analysis-capability.js";

const baseProfile: MachineProfile = {
  totalMemGb: 32,
  freeMemGb: 10,
  availableMemGb: 18,
  cpuCores: 8,
  platform: "darwin",
  arch: "arm64",
  gpu: "metal",
};

test("resolveLlmGpuForInfer uses none when free RAM low", () => {
  const prev = process.env.KCA_LLM_GPU;
  delete process.env.KCA_LLM_GPU;
  try {
    assert.equal(
      resolveLlmGpuForInfer({ ...baseProfile, freeMemGb: 3.5 }, "4B"),
      "none",
    );
    assert.equal(
      resolveLlmGpuForInfer({ ...baseProfile, freeMemGb: 5.5 }, "9B"),
      "none",
    );
    assert.equal(
      resolveLlmGpuForInfer({ ...baseProfile, freeMemGb: 10 }, "4B"),
      "auto",
    );
  } finally {
    if (prev === undefined) delete process.env.KCA_LLM_GPU;
    else process.env.KCA_LLM_GPU = prev;
  }
});
