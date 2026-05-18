import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSentimentStats } from "../src/sentiment-analyze.js";

describe("sentiment-analyze", () => {
  it("buildSentimentStats aggregates labels by sender", () => {
    const samples = [
      { text: "좋아요", sender: "a" },
      { text: "싫어", sender: "b" },
      { text: "그냥", sender: "a" },
    ];
    const stats = buildSentimentStats(
      samples,
      ["positive", "negative", "neutral"],
      new Map([
        ["a", "A"],
        ["b", "B"],
      ]),
    );
    assert.equal(stats.sampleSize, 3);
    assert.ok(stats.positivePercent > 0);
    assert.ok(stats.negativePercent > 0);
    assert.equal(stats.bySender.length, 2);
  });

  it("runs transformers batch when dependency is available", async (t) => {
    try {
      await import("@xenova/transformers");
    } catch {
      t.skip("optional @xenova/transformers not installed");
      return;
    }
    const { analyzeSentimentBatch } = await import("../src/sentiment-analyze.js");
    try {
      const labels = await analyzeSentimentBatch(["오늘 정말 좋은 하루", "별로인 날"]);
      assert.equal(labels.length, 2);
      assert.ok(labels.every((l) => l === "positive" || l === "negative" || l === "neutral"));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (/Unauthorized|fetch|ENOTFOUND|ECONNREFUSED|Could not locate file/i.test(msg)) {
        t.skip(`transformers model unavailable (번들 없음·Hub ONNX 미호스팅): ${msg.slice(0, 96)}`);
        return;
      }
      throw error;
    }
  });
});
