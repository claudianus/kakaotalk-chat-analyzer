import assert from "node:assert/strict";
import test from "node:test";
import { mergeEmbeddingThemes, semanticItemsToTopics } from "../src/embedding-topics.js";

test("semanticItemsToTopics builds theme cards from cluster labels", () => {
  const topics = semanticItemsToTopics(
    [{ label: "클로드 코덱스", score: 10, messageHits: 120 }],
    1000,
  );
  assert.equal(topics.length, 1);
  assert.equal(topics[0]!.kind, "theme");
  assert.ok(topics[0]!.title.includes("클로드"));
  assert.ok(!topics[0]!.title.includes("임베딩"));
});

test("mergeEmbeddingThemes dedupes overlapping graph themes", () => {
  const graph = [
    {
      id: "theme-0",
      kind: "theme" as const,
      title: "클로드 · 코덱스",
      terms: ["클로드", "코덱스"],
      messagePercent: 20,
    },
  ];
  const merged = mergeEmbeddingThemes(
    graph,
    [{ label: "클로드 코덱스", score: 5, messageHits: 50 }],
    500,
  );
  assert.equal(merged.length, 1);
});
