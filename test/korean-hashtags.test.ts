import assert from "node:assert/strict";
import test from "node:test";
import { extractHashtagKeywords } from "../src/korean-hashtags.js";

const emptyOpts = { senderNames: new Set<string>(), exclude: new Set<string>() };

test("extractHashtagKeywords extracts hashtags only", () => {
  const keys = extractHashtagKeywords("오늘 #대선 #이재명 토론", emptyOpts);
  assert.ok(keys.includes("대선"));
  assert.ok(keys.includes("이재명"));
  assert.equal(keys.length, 2);
});

test("extractHashtagKeywords dedupes within one message", () => {
  const keys = extractHashtagKeywords("#토론 #토론 #토론", emptyOpts);
  assert.deepEqual(keys, ["토론"]);
});

test("extractHashtagKeywords excludes sender names", () => {
  const keys = extractHashtagKeywords("#철수 #이재명", {
    senderNames: new Set(["철수"]),
    exclude: new Set(),
  });
  assert.deepEqual(keys, ["이재명"]);
});
