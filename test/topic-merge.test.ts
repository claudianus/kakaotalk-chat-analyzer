import assert from "node:assert/strict";
import test from "node:test";
import { buildKeywordSeedTopics } from "../src/keyword-seed-topics.js";
import { mergeTopicLanes, mergeTopicProposals } from "../src/topic-merge.js";
import type { ReportTopic } from "../src/types.js";

test("mergeTopicLanes combines graph, keyword, semantic lanes", () => {
  const graph: ReportTopic[] = [
    {
      id: "g0",
      kind: "theme",
      title: "회사 · 서비스",
      terms: ["회사", "서비스", "업무"],
      messagePercent: 4,
    },
  ];
  const keyword: ReportTopic[] = [
    {
      id: "k0",
      kind: "theme",
      title: "클로드 · 코덱스",
      terms: ["클로드", "코덱스"],
      messagePercent: 12,
    },
    {
      id: "k1",
      kind: "theme",
      title: "saas · 개발",
      terms: ["saas", "개발"],
      messagePercent: 8,
    },
    {
      id: "k2",
      kind: "theme",
      title: "토큰 · api",
      terms: ["토큰", "api"],
      messagePercent: 6,
    },
  ];
  const semantic: ReportTopic[] = [
    {
      id: "s0",
      kind: "theme",
      title: "클로드 · 코덱스",
      terms: ["클로드", "코덱스", "모델"],
      messagePercent: 10,
    },
  ];
  const merged = mergeTopicLanes({ graph, keyword, semantic }, 50_000);
  const themes = merged.filter((t) => t.kind === "theme");
  assert.ok(themes.length >= 3, `expected ≥3 themes, got ${themes.length}`);
  assert.ok(themes.some((t) => t.terms.includes("클로드")));
  const claudeThemes = themes.filter((t) => t.terms.includes("클로드") && t.terms.includes("코덱스"));
  assert.equal(claudeThemes.length, 1, "클로드·코덱스 순서만 다른 중복 테마는 1장으로 병합");
});

test("buildKeywordSeedTopics from frequency and distinctive lists", () => {
  const topics = buildKeywordSeedTopics(
    [
      { label: "클로드", count: 400 },
      { label: "코덱스", count: 200 },
    ],
    [{ label: "saas 개발", count: 80 }],
    10_000,
    null,
  );
  assert.ok(topics.length >= 2);
  assert.ok(topics[0]!.messagePercent > 0);
});

test("mergeTopicProposals requires keyword evidence", () => {
  const base: ReportTopic[] = [
    { id: "0", kind: "theme", title: "기존", terms: ["기존", "주제"], messagePercent: 5 },
  ];
  const withEvidence = mergeTopicProposals(
    base,
    [{ title: "AI 도구", terms: ["클로드", "코덱스"], keywordEvidence: ["클로드", "코덱스"] }],
    [
      { label: "클로드", count: 100 },
      { label: "코덱스", count: 80 },
    ],
    1000,
  );
  assert.ok(withEvidence.some((t) => t.title.includes("AI")));
  const rejected = mergeTopicProposals(
    base,
    [{ title: "허구", terms: ["없는단어"], keywordEvidence: ["없는단어"] }],
    [{ label: "클로드", count: 100 }],
    1000,
  );
  assert.equal(rejected.length, 1);
});
