import assert from "node:assert/strict";
import test from "node:test";
import { emptyReportData } from "../src/report-empty.js";
import { applyLlmEnrichment } from "../src/llm-summarize.js";
import {
  buildHarnessAttemptLadder,
  hasHarnessDeckContent,
  isHarnessSuccess,
} from "../src/llm-harness.js";
import { buildEnrichmentFromParsed } from "../src/llm-summarize.js";
import type { LlmEnrichmentResult } from "../src/llm-summarize.js";

test("buildHarnessAttemptLadder includes primary and downgrade steps", () => {
  const ladder = buildHarnessAttemptLadder({
    enabled: true,
    size: "4B",
    reason: "test",
    timeoutMs: 45_000,
  });
  assert.equal(ladder[0]?.label, "primary");
  assert.ok(ladder.some((a) => a.label === "compact-repair"));
  assert.ok(ladder.some((a) => a.label === "downgrade-0.8B"));
});

test("isHarnessSuccess accepts rule fallback deck", () => {
  const data = emptyReportData();
  data.keywords = [
    { label: "클로드", count: 10 },
    { label: "코덱스", count: 8 },
  ];
  data.topics = [
    {
      id: "t0",
      title: "AI 도구",
      terms: ["클로드", "코덱스"],
      messagePercent: 12,
      kind: "theme",
    },
  ];
  const parsed = {
    roomArchetype: { name: "chatroom", description: "messages are too general" },
    paragraphs: [],
  };
  const built = buildEnrichmentFromParsed(data, parsed, {
    enabled: true,
    size: "0.8B",
    reason: "test",
    timeoutMs: 45_000,
  });
  assert.equal(built.llmQuality?.fallbackUsed, true);
  assert.ok(isHarnessSuccess(built));
  assert.ok(hasHarnessDeckContent(built));
});

test("hasHarnessDeckContent false for empty enrichment", () => {
  const empty: LlmEnrichmentResult = {
    used: false,
    plan: { enabled: true, size: "0.8B", reason: "test", timeoutMs: 45_000 },
  };
  assert.equal(hasHarnessDeckContent(empty), false);
});

test("applyLlmEnrichment harness retries invalid JSON via mock", async () => {
  const prevMock = process.env.KCA_LLM_MOCK;
  const prevLlm = process.env.KCA_LLM;
  process.env.KCA_LLM = "1";
  try {
    process.env.KCA_LLM_MOCK = "invalid";
    const data = emptyReportData();
    const invalid = await applyLlmEnrichment(data, { preset: "custom" }, 10_000, {
      llmPlan: { enabled: true, size: "0.8B", reason: "invalid json test" },
    });
    assert.equal(invalid.used, false);
    assert.ok(invalid.llmQuality?.attempts && invalid.llmQuality.attempts.length >= 1);

    process.env.KCA_LLM_MOCK = "1";
    const valid = await applyLlmEnrichment(data, { preset: "custom" }, 10_000, {
      llmPlan: { enabled: true, size: "0.8B", reason: "valid mock test" },
    });
    assert.equal(valid.used, true);
    assert.ok((valid.llmQuality?.acceptedClaims ?? 0) > 0);
    assert.ok(valid.llmQuality?.attempts?.some((a) => a.ok));
  } finally {
    if (prevMock === undefined) delete process.env.KCA_LLM_MOCK;
    else process.env.KCA_LLM_MOCK = prevMock;
    if (prevLlm === undefined) delete process.env.KCA_LLM;
    else process.env.KCA_LLM = prevLlm;
  }
});
