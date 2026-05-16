import assert from "node:assert/strict";
import test from "node:test";
import { extractKoreanKeywords } from "../src/korean-keywords.js";

const emptyOpts = { senderNames: new Set<string>(), exclude: new Set<string>() };

test("extractKoreanKeywords drops laugh-only and filler", () => {
  const keys = extractKoreanKeywords("ㅋㅋㅋㅋ ㅇㅇ 그냥 응", emptyOpts);
  assert.equal(keys.length, 0);
});

test("extractKoreanKeywords keeps spaced political terms and bigrams", () => {
  const keys = extractKoreanKeywords("이재명 지지합니다 국민의힘 반대", emptyOpts);
  assert.ok(keys.includes("이재명"));
  assert.ok(keys.some((k) => k.includes("지지")));
  assert.ok(keys.includes("국민의힘") || keys.some((k) => k.includes("국민")));
});

test("extractKoreanKeywords splits glued hangul with particles", () => {
  const keys = extractKoreanKeywords("국민의힘이찬성한다", emptyOpts);
  assert.ok(keys.some((k) => k.includes("국민") || k.includes("찬성")));
});

test("extractKoreanKeywords skips chat slang tokens filtered by stopwords", () => {
  const keys = extractKoreanKeywords("ㄹㅇ 레전드 노답", emptyOpts);
  assert.equal(keys.includes("리얼"), false);
  assert.equal(keys.length, 0);
});

test("extractKoreanKeywords extracts hashtags", () => {
  const keys = extractKoreanKeywords("오늘 #대선 #이재명 토론", emptyOpts);
  assert.ok(keys.includes("대선"));
  assert.ok(keys.includes("이재명"));
});

test("extractKoreanKeywords dedupes within one message", () => {
  const keys = extractKoreanKeywords("이재명 이재명 이재명", emptyOpts);
  const count = keys.filter((k) => k === "이재명").length;
  assert.equal(count, 1);
});

test("extractKoreanKeywords excludes sender names", () => {
  const keys = extractKoreanKeywords("철수가 이재명 얘기함", {
    senderNames: new Set(["철수"]),
    exclude: new Set(),
  });
  assert.equal(keys.includes("철수"), false);
  assert.ok(keys.includes("이재명"));
});
