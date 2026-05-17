import assert from "node:assert/strict";
import test from "node:test";
import { buildKeywordSeedTopics } from "../src/keyword-seed-topics.js";
import { normalizeTopicTerm, topicPairKey, topicSimilarity } from "../src/topic-normalize.js";
import { mergeTopicLanes, mergeTopicProposals } from "../src/topic-merge.js";
import type { ReportTopic } from "../src/types.js";

test("topicPairKey ignores lead order", () => {
  assert.equal(topicPairKey("클로드 · 코덱스"), topicPairKey("코덱스 · 클로드"));
});

test("normalizeTopicTerm merges 클코 into 클로드", () => {
  assert.equal(normalizeTopicTerm("클코"), "클로드");
  assert.equal(normalizeTopicTerm("토큰이"), "토큰");
});

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

test("mergeTopicLanes collapses keyword permutation duplicates", () => {
  const keyword: ReportTopic[] = [
    {
      id: "k0",
      kind: "theme",
      title: "클로드 · 코덱스",
      terms: ["클로드", "코덱스", "개발", "토큰"],
      messagePercent: 1.9,
    },
    {
      id: "k1",
      kind: "theme",
      title: "클로드 · 코드",
      terms: ["클로드", "코드", "코덱스"],
      messagePercent: 1.9,
    },
    {
      id: "k2",
      kind: "theme",
      title: "코덱스 · 클로드",
      terms: ["코덱스", "클로드", "클코"],
      messagePercent: 1.4,
    },
    {
      id: "k3",
      kind: "theme",
      title: "코드 · 클로드",
      terms: ["코드", "클로드"],
      messagePercent: 0.8,
    },
    {
      id: "k4",
      kind: "theme",
      title: "클코 · 코덱스",
      terms: ["클코", "코덱스"],
      messagePercent: 0.6,
    },
    {
      id: "k5",
      kind: "theme",
      title: "개발 · 카톡",
      terms: ["개발", "카톡", "saas"],
      messagePercent: 1.1,
    },
    {
      id: "k6",
      kind: "theme",
      title: "모델 · 중국",
      terms: ["모델", "중국", "로컬"],
      messagePercent: 0.7,
    },
    {
      id: "k7",
      kind: "theme",
      title: "결제 · 클로드",
      terms: ["결제", "클로드", "달러"],
      messagePercent: 0.6,
    },
  ];
  const merged = mergeTopicLanes({ graph: [], keyword, semantic: [] }, 95_000);
  const themes = merged.filter((t) => t.kind === "theme");

  const claudeAxis = themes.filter(
    (t) =>
      (t.terms.includes("클로드") || normalizeTopicTerm(t.title).includes("클")) &&
      (t.terms.includes("코덱스") || t.title.includes("코덱스")),
  );
  assert.ok(
    claudeAxis.length <= 2,
    `클로드·코덱스 축 중복은 2장 이하, got ${claudeAxis.length}: ${claudeAxis.map((t) => t.title).join(", ")}`,
  );
  assert.ok(themes.some((t) => t.title.includes("개발") && t.title.includes("카톡")));
  assert.ok(themes.some((t) => t.title.includes("모델")));
  assert.ok(themes.some((t) => t.title.includes("결제")));
});

test("buildKeywordSeedTopics skips near-duplicate seeds", () => {
  const topics = buildKeywordSeedTopics(
    [
      { label: "클로드", count: 4000 },
      { label: "코덱스", count: 3000 },
      { label: "코드", count: 2500 },
      { label: "클코", count: 800 },
    ],
    [],
    95_000,
    null,
  );
  const claudeCodex = topics.filter(
    (t) => topicSimilarity(t, { id: "x", kind: "theme", title: "클로드 · 코덱스", terms: ["클로드", "코덱스"], messagePercent: 1 }) >= 0.45,
  );
  assert.ok(
    claudeCodex.length <= 2,
    `keyword seeds for 클로드/코덱스/코드/클코 should collapse, got ${topics.map((t) => t.title).join(", ")}`,
  );
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
