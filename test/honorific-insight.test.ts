import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReportAggregator } from "../src/aggregator.js";
import { renderReportHtml } from "../src/report.js";
import type { ChatRecord } from "../src/types.js";

function record(sender: string, message: string, line: number): ChatRecord {
  return {
    line,
    rawDate: "2024-01-01 12:00:00",
    date: { year: 2024, month: 1, day: 1, hour: 12, minute: 0, second: 0 },
    sender,
    message,
  };
}

function finalize(agg: ReportAggregator) {
  return agg.finalize({
    filePath: "/tmp/KakaoTalk_honorific.csv",
    encoding: "utf-8",
    physicalLines: 1,
    warningCount: 0,
  });
}

describe("honorific insight", () => {
  it("uses discriminative samples instead of low coverage to mark large samples insufficient", () => {
    const agg = new ReportAggregator("/tmp/KakaoTalk_honorific.csv", "public-masked", 10, {
      semanticSamples: false,
      sentimentSamples: false,
    });
    let line = 1;
    for (let i = 0; i < 40; i += 1) agg.consume(record("alice", "ㅋㅋㅋ", line++));
    for (let i = 0; i < 10; i += 1) agg.consume(record("alice", "좋아요", line++));

    const report = finalize(agg);
    const participant = report.honorificInsight?.participants[0];

    assert.equal(participant?.dominantStyle, "honorific");
    assert.equal(participant?.sampleCount, 50);
    assert.equal(participant?.styledSampleCount, 10);

    const html = renderReportHtml(report);
    assert.equal(html.includes("표본 부족"), false);
    assert.equal(html.includes("판단 보류"), false);
    assert.match(html, /honorific-bar-row/);
    assert.match(html, /존칭/);
    assert.match(html, /honorific-legend/);
    assert.match(html, /말끝 패턴/);
    assert.match(html, /존칭 \d+% · 반말/);
  });

  it("still defers when there are too few discriminative messages", () => {
    const agg = new ReportAggregator("/tmp/KakaoTalk_honorific.csv", "public-masked", 10, {
      semanticSamples: false,
      sentimentSamples: false,
    });
    let line = 1;
    for (let i = 0; i < 20; i += 1) agg.consume(record("alice", "ㅋㅋㅋ", line++));
    for (let i = 0; i < 2; i += 1) agg.consume(record("alice", "좋아요", line++));

    const report = finalize(agg);
    const participant = report.honorificInsight?.participants[0];

    assert.equal(participant?.dominantStyle, "insufficient");
    assert.equal(participant?.sampleCount, 22);
    assert.equal(participant?.styledSampleCount, 2);
  });
});
