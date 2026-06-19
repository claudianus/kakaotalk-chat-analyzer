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

  it("renders data panels as individual shot sections", () => {
    const data = emptyReportData();
    data.attachments = [{ label: "사진", count: 3 }];
    const html = renderReportHtml(data);
    assert.match(html, /class="kca-section card kca-shot-block kca-shot-panel/);
    assert.match(html, /첨부 유형/);
    assert.doesNotMatch(html, /kca-shot-stack kca-section kca-data-grid/);
  });
});
