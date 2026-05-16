import assert from "node:assert/strict";
import test from "node:test";
import { initKiwiRuntime, isKiwiReady } from "../src/kiwi-runtime.js";
import { tokenizeForKeywords, tokenizeHeuristicOnly } from "../src/keyword-tokenize.js";

test("Kiwi splits glued product names when runtime is ready", async (t) => {
  if (process.env.KCA_NO_KIWI === "1") {
    t.skip("KCA_NO_KIWI=1");
    return;
  }
  await initKiwiRuntime();
  if (!isKiwiReady()) {
    t.skip("Kiwi model unavailable in this environment");
    return;
  }
  const kiwi = tokenizeForKeywords("클로드코덱스로 개발중");
  const heur = tokenizeHeuristicOnly("클로드코덱스로 개발중");
  assert.ok(kiwi.includes("클로드") || kiwi.includes("코덱스"));
  assert.ok(heur.some((w) => w.includes("클로드코덱스") || w.length >= 6));
});
