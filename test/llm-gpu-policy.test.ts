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

test("resolveLlmGpuForInfer keeps Metal(auto) on macOS even at low free RAM", () => {
  const prev = process.env.KCA_LLM_GPU;
  delete process.env.KCA_LLM_GPU;
  try {
    // macOS는 통합 메모리 + Metal — os.freemem() 과소보고로 CPU 강제 시
    // 추론이 느려 타임아웃하거나 네이티브 크래시. Metal(auto) 유지.
    assert.equal(
      resolveLlmGpuForInfer({ ...baseProfile, freeMemGb: 3.5 }, "4B"),
      "auto",
    );
    assert.equal(
      resolveLlmGpuForInfer({ ...baseProfile, freeMemGb: 0.5 }, "9B"),
      "auto",
    );
  } finally {
    if (prev === undefined) delete process.env.KCA_LLM_GPU;
    else process.env.KCA_LLM_GPU = prev;
  }
});

test("resolveLlmGpuForInfer falls back to CPU on non-Metal platforms when free RAM low", () => {
  const prev = process.env.KCA_LLM_GPU;
  delete process.env.KCA_LLM_GPU;
  const linux: MachineProfile = { ...baseProfile, platform: "linux", gpu: "none" };
  try {
    assert.equal(resolveLlmGpuForInfer({ ...linux, freeMemGb: 3.5 }, "4B"), "none");
    assert.equal(resolveLlmGpuForInfer({ ...linux, freeMemGb: 5.5 }, "9B"), "none");
    assert.equal(resolveLlmGpuForInfer({ ...linux, freeMemGb: 10 }, "4B"), "auto");
  } finally {
    if (prev === undefined) delete process.env.KCA_LLM_GPU;
    else process.env.KCA_LLM_GPU = prev;
  }
});
