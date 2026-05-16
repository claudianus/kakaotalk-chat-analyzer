import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TopicMapAccumulator } from "../src/topic-map.js";

describe("TopicMapAccumulator", () => {
  it("builds theme topics from co-occurring tokens", () => {
    const acc = new TopicMapAccumulator();
    const stop = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      acc.addMessage(["클로드", "코덱스", "개발"], "2025-01");
      acc.addMessage(["클로드", "api", "테스트"], "2025-01");
    }
    const topics = acc.buildTopics(100, stop);
    assert.ok(topics.length >= 1);
    assert.equal(topics[0]!.kind, "theme");
    assert.ok(topics[0]!.terms.length >= 2);
  });

  it("returns empty for too few messages", () => {
    const acc = new TopicMapAccumulator();
    acc.addMessage(["hello", "world"], "2025-01");
    assert.deepEqual(acc.buildTopics(10, new Set()), []);
  });
});
