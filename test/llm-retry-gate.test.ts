import assert from "node:assert/strict";
import test from "node:test";
import type { MachineProfile } from "../src/analysis-capability.js";
import { canRetryLlmRam, minFreeGbForLlmRetry } from "../src/llm-resolve.js";
import { buildKcaLlmJsonSchema } from "../src/llm-schema.js";
import { isLlmGrammarEnabled } from "../src/llm-grammar.js";

function profile(freeMemGb: number, availableMemGb = 16): MachineProfile {
  return {
    totalMemGb: 32,
    freeMemGb,
    availableMemGb,
    cpuCores: 8,
    platform: "darwin",
    arch: "arm64",
    gpu: "none",
  };
}

test("canRetryLlmRam blocks when free below default floor", () => {
  assert.equal(canRetryLlmRam(profile(0.1, 16), "0.8B"), false);
  assert.equal(canRetryLlmRam(profile(2, 16), "0.8B"), true);
});

test("canRetryLlmRam respects KCA_LLM_MIN_FREE_GB", () => {
  const prev = process.env.KCA_LLM_MIN_FREE_GB;
  process.env.KCA_LLM_MIN_FREE_GB = "0";
  try {
    assert.equal(canRetryLlmRam(profile(0.1, 16), "0.8B"), true);
  } finally {
    if (prev === undefined) delete process.env.KCA_LLM_MIN_FREE_GB;
    else process.env.KCA_LLM_MIN_FREE_GB = prev;
  }
});

test("minFreeGbForLlmRetry default is 1.5", () => {
  const prev = process.env.KCA_LLM_MIN_FREE_GB;
  delete process.env.KCA_LLM_MIN_FREE_GB;
  try {
    assert.equal(minFreeGbForLlmRetry(), 1.5);
  } finally {
    if (prev === undefined) delete process.env.KCA_LLM_MIN_FREE_GB;
    else process.env.KCA_LLM_MIN_FREE_GB = prev;
  }
});

test("buildKcaLlmJsonSchema defines paragraphs array", () => {
  const schema = buildKcaLlmJsonSchema() as unknown as {
    type: string;
    properties?: { paragraphs?: { maxItems?: number; minItems?: number } };
  };
  assert.equal(schema.type, "object");
  assert.equal(schema.properties?.paragraphs?.maxItems, 3);
  assert.equal(schema.properties?.paragraphs?.minItems, 2);
});

test("isLlmGrammarEnabled defaults on", () => {
  const prev = process.env.KCA_LLM_GRAMMAR;
  delete process.env.KCA_LLM_GRAMMAR;
  try {
    assert.equal(isLlmGrammarEnabled(), true);
  } finally {
    if (prev === undefined) delete process.env.KCA_LLM_GRAMMAR;
    else process.env.KCA_LLM_GRAMMAR = prev;
  }
});

test("isLlmGrammarEnabled off when KCA_LLM_GRAMMAR=0", () => {
  const prev = process.env.KCA_LLM_GRAMMAR;
  process.env.KCA_LLM_GRAMMAR = "0";
  try {
    assert.equal(isLlmGrammarEnabled(), false);
  } finally {
    if (prev === undefined) delete process.env.KCA_LLM_GRAMMAR;
    else process.env.KCA_LLM_GRAMMAR = prev;
  }
});
