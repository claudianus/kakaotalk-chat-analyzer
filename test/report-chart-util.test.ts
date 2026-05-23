import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isShortActivitySpan, topicsForDisplay } from "../src/report-chart-util.js";
import { escapeHtml } from "../src/report-util.js";
import type { ReportTopic } from "../src/types.js";

describe("report-chart-util", () => {
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
