import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeProfanityText, ProfanityCounter } from "../src/profanity.js";

describe("profanity", () => {
  it("counts pattern hits per sender", () => {
    const counter = new ProfanityCounter(["시발", "ㅅㅂ"]);
    counter.add("아 시발 진짜", "alice");
    counter.add("ㅅㅂㅋㅋ", "bob");
    counter.add("안녕하세요", "alice");
    const stats = counter.buildProfanityStats(10, new Map([
      ["alice", "A"],
      ["bob", "B"],
    ]));
    assert.ok(stats.totalHits >= 2);
    assert.equal(stats.messagesWithProfanity, 2);
    assert.equal(stats.topBySender.length, 2);
    assert.equal(stats.topBySender[0]!.alias, "A");
  });

  it("normalizeProfanityText strips spaces", () => {
    assert.equal(normalizeProfanityText("시 발"), "시발");
  });
});
