import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyReportData } from "../src/report-empty.js";
import { renderReportHtml } from "../src/report.js";
import { REPORT_STYLES } from "../src/report-styles.js";

describe("report shot-frame layout", () => {
  it("bundles shot-frame CSS layer", () => {
    assert.match(REPORT_STYLES, /kca-shot-block/);
    assert.match(REPORT_STYLES, /kca-shot-max-h/);
  });

  it("flattens report flow without section clusters", () => {
    const html = renderReportHtml(emptyReportData());
    assert.match(html, /class="kca-report-flow"/);
    assert.match(html, /kca-shot-block/);
    assert.doesNotMatch(html, /class="[^"]*kca-section-cluster/);
  });

  it("splits story timeline into standalone shot sections", () => {
    const data = emptyReportData();
    data.memorableMoments = [
      {
        date: "2026-01-01",
        type: "peak_activity",
        title: "테스트",
        description: "하이라이트",
        messageCount: 10,
        participants: ["A"],
        keywords: ["키워드"],
      },
    ];
    data.timeline = [
      {
        date: "2026-01-02",
        kind: "burst",
        title: "급증",
        detail: "메시지 폭증",
      },
    ];
    const html = renderReportHtml(data);
    assert.match(html, /id="s-moments-timeline"/);
    assert.match(html, /id="s-spine-timeline"/);
    assert.doesNotMatch(html, /id="s-story-pair"/);
    assert.match(html, /data-kca-jump="s-moments-timeline"/);
  });

  it("splits recent snapshot into shot sections", () => {
    const data = emptyReportData();
    data.recentSnapshot = {
      lastDate: "2026-01-07",
      reportDay: "2026-01-07",
      weekTotal: 100,
      weekVsOverall: 1.2,
      weekParticipants: 5,
      weekKeywords: ["키워드"],
      today: {
        date: "2026-01-07",
        messageCount: 20,
        activeParticipants: 3,
        peakHour: 14,
        vsAvg: 1.5,
        keywords: ["a"],
        topSenders: [{ alias: "A", count: 10 }],
        hourly: Array(24).fill(1),
        sentiment: { positive: 40, negative: 10, neutral: 50 },
        headline: "오늘",
        hotTopicSummary: "요약",
        evidence: ["근거"],
      },
      week: [
        {
          date: "2026-01-06",
          messageCount: 15,
          activeParticipants: 2,
          peakHour: 10,
          vsAvg: 1.1,
          keywords: ["b"],
          topSenders: [],
          hourly: Array(24).fill(0),
          sentiment: { positive: 30, negative: 20, neutral: 50 },
        },
      ],
    };
    const html = renderReportHtml(data);
    assert.match(html, /id="s-recent"/);
    assert.match(html, /id="s-recent-today"/);
    assert.match(html, /id="s-recent-week"/);
    assert.match(html, /id="s-ai-emoji"/);
  });

  it("renders data panels as individual shot sections", () => {
    const data = emptyReportData();
    data.attachments = [{ label: "사진", count: 3 }];
    const html = renderReportHtml(data);
    assert.match(html, /class="kca-section card kca-shot-block kca-shot-panel/);
    assert.match(html, /첨부 유형/);
    assert.doesNotMatch(html, /kca-shot-stack kca-section kca-data-grid/);
  });
});
