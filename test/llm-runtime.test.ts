import assert from "node:assert/strict";
import test from "node:test";
import {
  applyGgmlMetalCompatibilityEnv,
  resolveLlamaGpuMode,
  resolveLlmSamplingParams,
} from "../src/llm-runtime.js";

test("resolveLlamaGpuMode parses env", () => {
  const prev = process.env.KCA_LLM_GPU;
  try {
    process.env.KCA_LLM_GPU = "none";
    assert.equal(resolveLlamaGpuMode(), "none");
    process.env.KCA_LLM_GPU = "metal";
    assert.equal(resolveLlamaGpuMode(), "metal");
    delete process.env.KCA_LLM_GPU;
    assert.equal(resolveLlamaGpuMode(), "auto");
  } finally {
    if (prev === undefined) delete process.env.KCA_LLM_GPU;
    else process.env.KCA_LLM_GPU = prev;
  }
});

test("applyGgmlMetalCompatibilityEnv sets tensor disable on darwin auto", () => {
  const prevGpu = process.env.KCA_LLM_GPU;
  const prevTensor = process.env.GGML_METAL_TENSOR_DISABLE;
  try {
    delete process.env.KCA_LLM_GPU;
    delete process.env.GGML_METAL_TENSOR_DISABLE;
    applyGgmlMetalCompatibilityEnv();
    if (process.platform === "darwin") {
      assert.equal(process.env.GGML_METAL_TENSOR_DISABLE, "1");
    }
    process.env.KCA_LLM_GPU = "metal";
    delete process.env.GGML_METAL_TENSOR_DISABLE;
    applyGgmlMetalCompatibilityEnv();
    assert.equal(process.env.GGML_METAL_TENSOR_DISABLE, undefined);
  } finally {
    if (prevGpu === undefined) delete process.env.KCA_LLM_GPU;
    else process.env.KCA_LLM_GPU = prevGpu;
    if (prevTensor === undefined) delete process.env.GGML_METAL_TENSOR_DISABLE;
    else process.env.GGML_METAL_TENSOR_DISABLE = prevTensor;
  }
});

test("resolveLlmSamplingParams Qwen3.5 instruct defaults", () => {
  const prevT = process.env.KCA_LLM_TEMPERATURE;
  const prevP = process.env.KCA_LLM_TOP_P;
  delete process.env.KCA_LLM_TEMPERATURE;
  delete process.env.KCA_LLM_TOP_P;
  try {
    const s = resolveLlmSamplingParams();
    assert.equal(s.temperature, 0.7);
    assert.equal(s.topP, 0.8);
    assert.equal(s.topK, 20);
  } finally {
    if (prevT === undefined) delete process.env.KCA_LLM_TEMPERATURE;
    else process.env.KCA_LLM_TEMPERATURE = prevT;
    if (prevP === undefined) delete process.env.KCA_LLM_TOP_P;
    else process.env.KCA_LLM_TOP_P = prevP;
  }
});
