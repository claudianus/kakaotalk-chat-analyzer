import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isShortActivitySpan, topicsForDisplay } from "../src/report-chart-util.js";
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
