import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReportAggregator } from "../src/aggregator.js";
import type { ChatRecord, PrivacyMode } from "../src/types.js";

const PRIVACY: PrivacyMode = "public-anonymous";

function makeRecord(date: string, sender: string, message: string): ChatRecord {
  const d = new Date(date);
  return {
    line: 0,
    rawDate: date,
    date: {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hour: d.getHours(),
      minute: d.getMinutes(),
      second: d.getSeconds(),
    },
    sender,
    message,
  };
}

describe("innovation aggregate metrics", () => {
  it("computes reply latency fingerprint", () => {
    const agg = new ReportAggregator("test.csv", PRIVACY, 20);
    agg.consume(makeRecord("2026-01-01 09:00:00", "A", "안녕"));
    agg.consume(makeRecord("2026-01-01 09:02:00", "B", "반가워"));
    agg.consume(makeRecord("2026-01-01 09:03:00", "A", "뭐해?"));
    agg.consume(makeRecord("2026-01-01 09:05:00", "B", "일하고 있어"));
    agg.consume(makeRecord("2026-01-01 09:20:00", "A", "점심 먹을래?"));
    agg.consume(makeRecord("2026-01-01 09:22:00", "B", "그래"));
    const data = agg.finalize({ filePath: "test.csv", encoding: "utf-8", physicalLines: 6, warningCount: 0 });

    assert.ok(data.replyLatency);
    assert.equal(data.replyLatency.totalReplies, 5);
    assert.equal(data.replyLatency.responders.length, 2);
    const b = data.replyLatency.responders.find((r) => r.alias === "User 002");
    assert.ok(b);
    assert.equal(b.medianMinutes, 2);
    assert.equal(b.replies, 3);
  });

  it("computes question-answer topology", () => {
    const agg = new ReportAggregator("test.csv", PRIVACY, 20);
    agg.consume(makeRecord("2026-01-01 09:00:00", "A", "오늘 몇 시에 만날까?"));
    agg.consume(makeRecord("2026-01-01 09:02:00", "B", "2시 어때?"));
    agg.consume(makeRecord("2026-01-01 09:05:00", "A", "점심 뭐 먹을래?"));
    agg.consume(makeRecord("2026-01-01 09:06:00", "B", "김치찌개"));
    agg.consume(makeRecord("2026-01-01 09:10:00", "C", "저도 갈래요?"));
    const data = agg.finalize({ filePath: "test.csv", encoding: "utf-8", physicalLines: 5, warningCount: 0 });

    assert.ok(data.questionAnswer);
    assert.ok(data.questionAnswer.totalQuestions >= 3);
    assert.ok(data.questionAnswer.answerRatePercent > 0);
    const pair = data.questionAnswer.topPairs.find((p) => p.asker === "User 001" && p.answerer === "User 002");
    assert.ok(pair);
    assert.ok(pair.questions >= 1);
  });

  it("computes burst anatomy", () => {
    const agg = new ReportAggregator("test.csv", PRIVACY, 20);
    // 4일 이상이어야 버스트 탐지가 작동함
    for (let day = 1; day <= 5; day++) {
      const date = `2026-01-${String(day).padStart(2, "0")}`;
      const count = day === 3 ? 30 : 5;
      for (let i = 0; i < count; i++) {
        agg.consume(makeRecord(`${date} 09:${String(i * 2).padStart(2, "0")}:00`, i % 2 === 0 ? "A" : "B", `메시지 ${i}`));
      }
    }
    const data = agg.finalize({ filePath: "test.csv", encoding: "utf-8", physicalLines: 50, warningCount: 0 });

    assert.ok(data.burstAnatomy.length > 0);
    const burst = data.burstAnatomy[0];
    assert.ok(burst.messages >= 20);
    assert.ok(burst.vsAverage > 1);
    assert.ok(burst.participants.includes("User 001"));
  });
});
