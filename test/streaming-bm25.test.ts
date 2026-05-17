import assert from "node:assert/strict";
import test from "node:test";
import { bm25Score } from "../src/streaming-tfidf-keywords.js";

test("bm25Score prefers moderate df over ultra-common terms", () => {
  const N = 10_000;
  const avgDl = 12;
  const rare = bm25Score(40, 80, N, avgDl);
  const common = bm25Score(4000, 9000, N, avgDl);
  assert.ok(rare > common);
});
