import assert from "node:assert/strict";
import test from "node:test";
import { canonicalKeywordToken } from "../src/keyword-canonical.js";
import { tokenizeForKeywords } from "../src/keyword-tokenize.js";
import { initKiwiRuntime, isKiwiReady } from "../src/kiwi-runtime.js";

test("canonicalKeywordToken merges latin brand spellings", () => {
  assert.equal(canonicalKeywordToken("claude"), "클로드");
  assert.equal(canonicalKeywordToken("Codex"), "코덱스");
  assert.equal(canonicalKeywordToken("클로드"), "클로드");
});

test("tokenizeForKeywords keeps space tokens when Kiwi returns other nouns only", async (t) => {
  if (process.env.KCA_NO_KIWI === "1") {
    t.skip("KCA_NO_KIWI=1");
    return;
  }
  await initKiwiRuntime();
  if (!isKiwiReady()) {
    t.skip("Kiwi unavailable");
    return;
  }
  const tokens = tokenizeForKeywords("오늘 회의하고 저녁에 Claude 쓸게");
  assert.ok(tokens.includes("클로드") || tokens.includes("claude"));
  assert.ok(tokens.includes("회의") || tokens.includes("저녁"));
});
