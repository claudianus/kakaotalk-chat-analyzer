import assert from "node:assert/strict";
import test from "node:test";
import { KeywordCounter } from "../src/keyword-counter.js";
import { keywordLaneCaps, mergeDualLaneKeywords } from "../src/keyword-rank-dual.js";

test("keywordLaneCaps scales freqCap with corpus size", () => {
  assert.equal(keywordLaneCaps(1_500, 40).freqCap, 32);
  assert.equal(keywordLaneCaps(25_000, 40).freqCap, 60);
  assert.equal(keywordLaneCaps(95_000, 40).freqCap, 80);
});

test("mergeDualLaneKeywords ranks high df domain terms above rare high-BM25 ngrams", () => {
  const candidates = [
    { label: "희귀2gram", score: 48, messageHits: 65 },
    { label: "클로드", score: 9, messageHits: 2_750 },
    { label: "코덱스", score: 8, messageHits: 1_800 },
    { label: "잡담", score: 4, messageHits: 12_000 },
  ];
  const merged = mergeDualLaneKeywords(candidates, new KeywordCounter(), 55_000, 10);
  assert.ok(merged.byFrequency.length > 0);
  const top = merged.byFrequency[0]!.label;
  assert.ok(
    top === "잡담" || top === "클로드",
    `expected frequent term first, got ${top} (${merged.byFrequency.map((x) => `${x.label}:${x.count}`).join(", ")})`,
  );
  assert.ok(merged.byFrequency[0]!.count >= 65);
  const rareIdx = merged.distinctive.findIndex((x) => x.label === "희귀2gram");
  if (rareIdx >= 0) assert.ok(rareIdx >= 2, "rare ngram should not dominate top2");
});

test("mergeDualLaneKeywords applies semantic supplement only with corpus df", () => {
  const candidates = [
    { label: "클로드", score: 10, messageHits: 200 },
    { label: "코드", score: 8, messageHits: 180 },
  ];
  const supp = new KeywordCounter();
  supp.addHits("테스트", 50);
  supp.addHits("클로드", 200);
  const merged = mergeDualLaneKeywords(candidates, supp, 10_000, 5, 0.85);
  assert.ok(merged.byFrequency.some((x) => x.label === "클로드"));
  assert.equal(merged.byFrequency.some((x) => x.label === "테스트"), false);
});

test("byFrequency sorts by message count; distinctive by composite", () => {
  const candidates = [
    { label: "saas 개발", score: 40, messageHits: 468 },
    { label: "클로드", score: 8, messageHits: 1796 },
    { label: "코덱스", score: 9, messageHits: 1328 },
  ];
  const merged = mergeDualLaneKeywords(candidates, new KeywordCounter(), 90_000, 10);
  assert.equal(merged.byFrequency[0]!.label, "클로드");
  assert.ok(
    merged.distinctive.findIndex((x) => x.label === "saas 개발") <
      merged.distinctive.findIndex((x) => x.label === "코덱스"),
  );
});
