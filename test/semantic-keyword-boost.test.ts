import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReportAggregator, semanticSupplementHitCap } from "../src/aggregator.js";
import type { KeywordCounter } from "../src/keyword-counter.js";

function supplementOf(agg: ReportAggregator): KeywordCounter {
  return (agg as unknown as { keywordSupplement: KeywordCounter }).keywordSupplement;
}

describe("semantic keyword boost", () => {
  it("semanticSupplementHitCap bounds large corpus hits", () => {
    assert.equal(semanticSupplementHitCap(90_000), 24);
    assert.equal(semanticSupplementHitCap(16), 8);
  });

  it("applySemanticKeywordBoost stores themes only; supplement needs BM25 match", () => {
    const agg = new ReportAggregator("room.csv", "public-masked", 30, {
      semanticSamples: false,
    });
    agg.applySemanticKeywordBoost([
      { label: "감사합니다", messageHits: 500, score: 90 },
      { label: "claude", messageHits: 500, score: 80 },
      { label: "codex", messageHits: 40, score: 70 },
    ]);
    const supp = supplementOf(agg);
    assert.equal(supp.topCounts(10).length, 0);

    agg.applySemanticSupplementForRanked([
      { label: "claude", messageHits: 120 },
      { label: "codex", messageHits: 80 },
    ]);
    const counts = new Map(supp.topCounts(10).map((x) => [x.label, x.count]));
    assert.equal(counts.has("감사합니다"), false);
    assert.equal(counts.get("claude"), 120);
    assert.equal(counts.get("codex"), 80);

    const themes = (agg as unknown as { semanticThemeCandidates: { label: string }[] })
      .semanticThemeCandidates;
    assert.ok(themes.some((t) => t.label === "claude"));
    assert.ok(themes.every((t) => t.label !== "감사합니다"));
  });
});
