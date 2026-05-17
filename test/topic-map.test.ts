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
    const theme = topics.find((t) => t.kind === "theme");
    assert.ok(theme, "expected at least one theme topic");
    assert.ok(theme!.terms.length >= 2);
  });

  it("returns empty for too few messages", () => {
    const acc = new TopicMapAccumulator();
    acc.addMessage(["hello", "world"], "2025-01");
    assert.deepEqual(acc.buildTopics(10, new Set()), []);
  });

  it("omits weak discourse-heavy themes under message percent gate", () => {
    const acc = new TopicMapAccumulator();
    const stop = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      acc.addMessage(["클로드", "코덱스", "개발"], "2025-01");
      acc.addMessage(["클로드", "api", "테스트"], "2025-01");
      acc.addMessage(["감사합니다", "있어요", "부탁"], "2025-01");
    }
    const topics = acc.buildTopics(150, stop).filter((t) => t.kind === "theme");
    assert.ok(topics.length > 0, "expected at least one retained theme topic");
    for (const t of topics) {
      assert.ok(t.messagePercent >= 1.5, `weak theme: ${t.title} ${t.messagePercent}%`);
      assert.ok(!/^(감사합니다|있어요|부탁)$/.test(t.title.split(" · ")[0] ?? ""));
    }
  });
});
