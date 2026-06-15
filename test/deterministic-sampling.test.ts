import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { kMeansAssignments, normalizeVector } from "../src/embedding-cluster.js";
import { MessageReservoir } from "../src/message-reservoir.js";
import { SenderMessageReservoir } from "../src/sender-message-reservoir.js";

describe("deterministic sampling", () => {
  it("MessageReservoir returns stable samples for identical input", () => {
    const input = Array.from({ length: 80 }, (_, i) => `메시지 ${i} 클로드 코덱스 테스트`);
    const a = new MessageReservoir(12);
    const b = new MessageReservoir(12);
    for (const msg of input) {
      a.push(msg);
      b.push(msg);
    }
    assert.deepEqual(a.drain(), b.drain());
  });

  it("SenderMessageReservoir returns stable sender/text pairs", () => {
    const a = new SenderMessageReservoir(10);
    const b = new SenderMessageReservoir(10);
    for (let i = 0; i < 60; i += 1) {
      const sender = i % 2 === 0 ? "A" : "B";
      const text = `감정 분석 샘플 ${i}`;
      a.push(text, sender);
      b.push(text, sender);
    }
    assert.deepEqual(a.drain(), b.drain());
  });

  it("kMeansAssignments is stable across repeated runs", () => {
    const vectors = [
      normalizeVector([1, 0, 0]),
      normalizeVector([0.95, 0.05, 0]),
      normalizeVector([0, 1, 0]),
      normalizeVector([0.05, 0.95, 0]),
      normalizeVector([0, 0, 1]),
      normalizeVector([0, 0.05, 0.95]),
    ];
    assert.deepEqual(kMeansAssignments(vectors, 3, 10), kMeansAssignments(vectors, 3, 10));
  });
});
