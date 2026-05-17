import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReportAggregator } from "../src/aggregator.js";
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

describe("participant character rank", () => {
  it("computes characterSharePercent and sorts participantsByCharacters", () => {
    const agg = new ReportAggregator("/tmp/KakaoTalk_test.csv", "public-masked", 10, {
      semanticSamples: false,
      sentimentSamples: false,
    });
    agg.consume(record("alice", "짧은", 1));
    agg.consume(record("alice", "짧은", 2));
    agg.consume(record("bob", "아주 긴 메시지 본문입니다", 3));
    const report = agg.finalize({
      filePath: "/tmp/KakaoTalk_test.csv",
      encoding: "utf-8",
      physicalLines: 4,
      warningCount: 0,
    });
    assert.ok(report.participantsByCharacters[0]!.characters >= report.participantsByCharacters[1]!.characters);
    const bob = report.participantsByCharacters.find((p) => p.alias.startsWith("b") || p.messages === 1);
    assert.ok(bob);
    assert.ok(bob!.characterSharePercent > 0);
    const sumShare = report.participantsByCharacters.reduce((s, p) => s + p.characterSharePercent, 0);
    assert.ok(sumShare <= 100.5);
    assert.ok(report.profanity.totalHits >= 0);
    assert.equal(report.sentiment, null);
  });
});
