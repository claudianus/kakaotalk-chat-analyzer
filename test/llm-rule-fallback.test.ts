import assert from "node:assert/strict";
import test from "node:test";
import { buildRuleBasedLlmFallback } from "../src/llm-rule-fallback.js";
import { emptyReportData } from "../src/report-empty.js";

test("buildRuleBasedLlmFallback produces archetype and bullets from stats", () => {
  const data = emptyReportData();
  data.summary.totalMessages = 5000;
  data.summary.participants = 12;
  data.keywords = [
    { label: "클로드", count: 120 },
    { label: "코덱스", count: 100 },
    { label: "개발", count: 80 },
  ];
  data.topics = [
    { id: "t0", kind: "theme", title: "AI 코딩", terms: ["클로드", "코덱스"], messagePercent: 22 },
  ];
  data.highlights = ["총 5000건", "참여자 12명", "리듬 점수 72"];

  const out = buildRuleBasedLlmFallback(data, {
    enabled: true,
    size: "2B",
    reason: "inference fail",
    timeoutMs: 45_000,
  });

  assert.equal(out.used, true);
  assert.ok(out.llmInsights?.roomArchetype?.name);
  assert.ok((out.llmInsights?.insightBullets?.length ?? 0) >= 2);
  assert.equal(out.llmQuality?.fallbackUsed, true);
});

test("buildRuleBasedLlmFallback returns unused when no evidence", () => {
  const data = emptyReportData();
  const out = buildRuleBasedLlmFallback(data, {
    enabled: true,
    size: "0.8B",
    reason: "fail",
    timeoutMs: 45_000,
  });
  assert.equal(out.used, false);
});
