import assert from "node:assert/strict";
import test from "node:test";
import { KeywordCounter } from "../src/keyword-counter.js";
import { mergeKeywordRankings } from "../src/keyword-merge.js";

test("mergeKeywordRankings prefers BM25 score over raw doc frequency", () => {
  const ranked = [
    { label: "클로드", score: 12, messageHits: 5 },
    { label: "코덱스", score: 8, messageHits: 40 },
    { label: "개발", score: 6, messageHits: 30 },
  ];
  const supp = new KeywordCounter();
  const merged = mergeKeywordRankings(ranked, supp, 5);
  assert.equal(merged[0]!.label, "클로드");
});

test("mergeKeywordRankings fuses supplement via RRF", () => {
  const ranked = [
    { label: "클로드", score: 10, messageHits: 20 },
    { label: "코드", score: 8, messageHits: 18 },
  ];
  const supp = new KeywordCounter();
  supp.addHits("테스트", 15);
  const merged = mergeKeywordRankings(ranked, supp, 5);
  assert.ok(merged.length >= 3);
  assert.ok(merged.some((x) => x.label === "클로드"));
  assert.ok(merged.some((x) => x.label === "테스트"));
});
