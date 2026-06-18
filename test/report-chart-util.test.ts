import assert from "node:assert/strict";
import { describe, it, test } from "node:test";
import {
  chooseTopicTrendGranularity,
  cloudChartMode,
  isCloudNoiseLabel,
  isShortActivitySpan,
  keywordsForCloud,
  topicsForDisplay,
} from "../src/report-chart-util.js";
import { escapeHtml } from "../src/report-util.js";
import type { ReportTopic } from "../src/types.js";

describe("report-chart-util", () => {
  it("chooses topic trend granularity from report span", () => {
    assert.equal(chooseTopicTrendGranularity({ activeDays: 8, spanDays: 12 }), "daily");
    assert.equal(chooseTopicTrendGranularity({ activeDays: 40, spanDays: 90 }), "weekly");
    assert.equal(chooseTopicTrendGranularity({ activeDays: 120, spanDays: 240 }), "monthly");
  });

  it("hides period topics on short two-month spans", () => {
    const daily = [
      { date: "2026-04-13", count: 10 },
      { date: "2026-05-16", count: 20 },
    ];
    assert.equal(isShortActivitySpan(daily), true);
    const topics: ReportTopic[] = [
      {
        id: "m1",
        kind: "period",
        title: "2026년 4월",
        terms: ["a", "b"],
        messagePercent: 45,
      },
      {
        id: "t1",
        kind: "theme",
        title: "클로드",
        terms: ["클로드", "코덱스"],
        messagePercent: 12,
      },
    ];
    const out = topicsForDisplay(topics, daily);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.kind, "theme");
  });

  it("normalizes impossible topic percentages before display", () => {
    const topics: ReportTopic[] = [
      { id: "neg", kind: "theme", title: "음수", terms: ["a"], messagePercent: -1.8 },
      { id: "huge", kind: "theme", title: "초과", terms: ["b"], messagePercent: 140 },
    ];
    const out = topicsForDisplay(topics, [{ date: "2026-04-13", count: 10 }]);
    assert.equal(out[0]!.messagePercent, 0);
    assert.equal(out[1]!.messagePercent, 100);
  });
});

describe("escapeHtml (chart tooltip XSS prevention)", () => {
  it("escapes HTML special characters in user data", () => {
    assert.equal(escapeHtml("<script>"), "&lt;script&gt;");
    assert.equal(escapeHtml('"><img onerror=alert(1)>'), "&quot;&gt;&lt;img onerror=alert(1)&gt;");
    assert.equal(escapeHtml("&"), "&amp;");
    assert.equal(escapeHtml("'"), "&#39;");
  });
  it("preserves safe strings", () => {
    assert.equal(escapeHtml("User 001"), "User 001");
    assert.equal(escapeHtml("안녕하세요"), "안녕하세요");
  });
});

test("keywordsForCloud filters shop-search boilerplate", () => {
  const out = keywordsForCloud([
    { label: "사이트", count: 680 },
    { label: "요약입니다", count: 646 },
    { label: "클로드", count: 501, keywordLane: "both" },
    { label: "arxiv", count: 120, keywordLane: "bm25" },
  ]);
  const labels = out.map((k) => k.label);
  assert.ok(labels.includes("클로드"));
  assert.ok(!labels.includes("요약입니다"));
});

test("keywordsForCloud filters HTML scrape tokens", () => {
  const out = keywordsForCloud([
    { label: "articleview html", count: 52 },
    { label: "html idxno", count: 52 },
    { label: "프레임 워크", count: 40 },
    { label: "클로드", count: 501, keywordLane: "both" },
  ]);
  const labels = out.map((k) => k.label);
  assert.ok(!labels.includes("articleview html"));
  assert.ok(labels.includes("프레임 워크"));
});

test("cloudChartMode prefers bar for noisy keywords", () => {
  assert.equal(
    cloudChartMode([
      { label: "articleview html", count: 52 },
      { label: "html idxno", count: 50 },
      { label: "short", count: 40 },
      { label: "oursophy", count: 38 },
    ]),
    "bar",
  );
  assert.equal(isCloudNoiseLabel("articleview html"), true);
});
