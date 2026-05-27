import assert from "node:assert/strict";
import test from "node:test";
import { emptyReportData } from "../src/report-empty.js";
import { applyLlmEnrichment } from "../src/llm-summarize.js";

test("applyLlmEnrichment with KCA_LLM_MOCK updates narrative", async () => {
  const prevMock = process.env.KCA_LLM_MOCK;
  const prevLlm = process.env.KCA_LLM;
  process.env.KCA_LLM_MOCK = "1";
  process.env.KCA_LLM = "1";
  try {
    const data = emptyReportData();
    const result = await applyLlmEnrichment(data, { preset: "custom" }, 10_000);
    assert.equal(result.used, true);
    assert.ok(
      result.narrative?.paragraphs.some((p) => p.includes("통계 기반")) ||
        result.topics?.some((t) => t.title.includes("모의")),
    );
    assert.ok(result.llmInsights?.roomArchetype?.name);
  } finally {
    if (prevMock === undefined) delete process.env.KCA_LLM_MOCK;
    else process.env.KCA_LLM_MOCK = prevMock;
    if (prevLlm === undefined) delete process.env.KCA_LLM;
    else process.env.KCA_LLM = prevLlm;
  }
});

test("applyLlmEnrichment off when KCA_LLM=0 (any preset)", async () => {
  const prev = process.env.KCA_LLM;
  process.env.KCA_LLM = "0";
  try {
    const data = emptyReportData();
    const result = await applyLlmEnrichment(data, { preset: "speed" }, 10_000);
    assert.equal(result.used, false);
    assert.equal(result.plan.enabled, false);
  } finally {
    if (prev === undefined) delete process.env.KCA_LLM;
    else process.env.KCA_LLM = prev;
  }
});

test("applyLlmEnrichment skips gracefully on invalid mock JSON without throw", async () => {
  const prevMock = process.env.KCA_LLM_MOCK;
  const prevLlm = process.env.KCA_LLM;
  process.env.KCA_LLM_MOCK = "invalid";
  process.env.KCA_LLM = "1";
  try {
    const data = emptyReportData();
    const result = await applyLlmEnrichment(data, { preset: "custom" }, 10_000, {
      llmPlan: { enabled: true, size: "0.8B", reason: "test invalid JSON" },
    });
    assert.equal(result.used, false);
    assert.ok(result.skipReason?.includes("JSON 파싱 실패"));
  } finally {
    if (prevMock === undefined) delete process.env.KCA_LLM_MOCK;
    else process.env.KCA_LLM_MOCK = prevMock;
    if (prevLlm === undefined) delete process.env.KCA_LLM;
    else process.env.KCA_LLM = prevLlm;
  }
});
