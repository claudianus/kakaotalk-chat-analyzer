import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HeuristicPrepassCollector } from "../src/export-prepass.js";
import { isPrimarilyKoreanMessages, isPrimarilyKoreanText } from "../src/korean-locale.js";
import { resolveSemanticKeywords } from "../src/semantic-policy.js";

describe("korean-locale", () => {
  it("detects Korean-primary chat", () => {
    const msgs = Array.from({ length: 30 }, (_, i) => `${i}번째 클로드 코덱스 개발 얘기`);
    assert.equal(isPrimarilyKoreanMessages(msgs), true);
    assert.equal(isPrimarilyKoreanText(msgs.join("\n"), msgs.length), true);
  });

  it("rejects English-primary chat for auto semantic", () => {
    const msgs = Array.from(
      { length: 30 },
      () => "only english discussion about software engineering and APIs",
    );
    assert.equal(isPrimarilyKoreanMessages(msgs), false);
  });

  it("resolveSemanticKeywords defaults on for Korean room", () => {
    const prepass = new HeuristicPrepassCollector();
    for (let i = 0; i < 50; i += 1) {
      prepass.onMessageText(`한국어 메시지 ${i} 클로드 코덱스`);
    }
    assert.equal(resolveSemanticKeywords(undefined, prepass, prepass.sampleTexts()), true);
    assert.equal(resolveSemanticKeywords({ semanticKeywords: false }, prepass, prepass.sampleTexts()), false);
  });
});
