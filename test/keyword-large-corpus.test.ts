import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { KeywordCounter } from "../src/keyword-counter.js";
import { mergeKeywordRankings } from "../src/keyword-merge.js";
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
    const items = stream.extractKeywordItems({ limit: 120, minDocFreq: minDf });
    assert.ok(items.length > 0, "expected keyword items");
    const top10 = items.slice(0, 10);
    const domain = top10.find((x) => x.label.includes("클로드") || x.label === "클로드");
    assert.ok(domain, `expected 클로드 in top10, got: ${top10.map((x) => `${x.label}(${x.messageHits})`).join(", ")}`);
    assert.ok(domain!.messageHits >= 50, `클로드 hits too low: ${domain!.messageHits}`);
    assert.ok(top10[0]!.messageHits >= 50, `top1 hits too low: ${top10[0]!.label}=${top10[0]!.messageHits}`);

    const merged = mergeKeywordRankings(items.slice(0, 40), new KeywordCounter(), 20);
    assert.ok(merged[0]!.count >= 50);
    assert.equal(merged.some((x) => x.count <= 5), false);
  });
});
