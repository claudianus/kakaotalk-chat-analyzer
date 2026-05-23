import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { KeywordCounter } from "../src/keyword-counter.js";
import { mergeDualLaneKeywords } from "../src/keyword-rank-dual.js";
import { adaptiveMinCount } from "../src/keyword-rank.js";
import { StreamingTfidfKeywords } from "../src/streaming-tfidf-keywords.js";
import { tokenizeForKeywords } from "../src/keyword-tokenize.js";

describe("large corpus keywords", () => {
  it("adaptiveMinCount scales up for 50k+ messages", () => {
    assert.equal(adaptiveMinCount(9_000), 4);
    assert.equal(adaptiveMinCount(55_000), 12);
    assert.equal(adaptiveMinCount(120_000), 20);
  });

  it("surfaces frequent domain terms with realistic messageHits at 55k scale", () => {
    const stream = new StreamingTfidfKeywords();
    const corpusSize = 55_000;
    for (let i = 0; i < corpusSize; i += 1) {
      const msg =
        i % 20 === 0
          ? "클로드 코덱스 API로 바이브코딩 중입니다"
          : "오늘 날씨 좋고 일반 잡담 메시지 반가워요";
      stream.addDocumentTokens(tokenizeForKeywords(msg));
    }
    const minDf = adaptiveMinCount(corpusSize);
    assert.equal(minDf, 12);
    const candidates = stream.collectKeywordCandidates({ minDocFreq: minDf });
    assert.ok(candidates.length > 0, "expected keyword candidates");
    const merged = mergeDualLaneKeywords(candidates, new KeywordCounter(), corpusSize, 20);
    const freq = merged.byFrequency;
    assert.ok(freq[0]!.count >= 50, `top1 hits too low: ${freq[0]!.label}=${freq[0]!.count}`);
    const domain = freq.find((x) => x.label.includes("클로드") || x.label === "클로드");
    assert.ok(domain, `expected 클로드 in merged top20, got: ${freq.slice(0, 8).map((x) => `${x.label}(${x.count})`).join(", ")}`);
    assert.ok(domain!.count >= 50, `클로드 hits too low: ${domain!.count}`);
    assert.equal(freq.some((x) => x.count <= 5), false);
  });

  it("prune resets totalHits to sum of kept entries", () => {
    const kc = new KeywordCounter();
    // MAX_KEYS=24000, PRUNE_TO=18000. Fill beyond MAX_KEYS to trigger prune.
    for (let i = 0; i < 25_000; i += 1) {
      kc.add(`token-${i}`);
    }
    const top1 = kc.top1SharePercent();
    assert.ok(top1 !== null, "top1SharePercent should not be null");
    // After pruning to 18000 keys with ~1 hit each, totalHits ≈ 18000
    // maxCount should be 1 (all tokens have 1 hit)
    assert.ok(top1! <= 0.1, `top1SharePercent should be ~0.006% not ${top1}%`);
  });
});
