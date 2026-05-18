import assert from "node:assert/strict";
import test from "node:test";
import { extractLlmJsonObject } from "../src/llm-json.js";

test("extractLlmJsonObject parses bare JSON", () => {
  const parsed = extractLlmJsonObject(
    '{"topicTitles":[{"i":0,"title":"정치"}],"paragraphs":["첫 문단"]}',
  );
  assert.equal(parsed?.topicTitles?.[0]?.title, "정치");
  assert.equal(parsed?.paragraphs?.[0], "첫 문단");
});

test("extractLlmJsonObject strips markdown fence and Korean prefix", () => {
  const raw = `다음은 JSON입니다.
\`\`\`json
{"paragraphs":["**강조** 서사"],"insightBullets":["참여자 40명"]}
\`\`\``;
  const parsed = extractLlmJsonObject(raw);
  assert.equal(parsed?.paragraphs?.[0], "**강조** 서사");
  assert.equal(parsed?.insightBullets?.[0], "참여자 40명");
});

test("extractLlmJsonObject strips thinking block suffix", () => {
  const raw = `내부 추론
{"topicTitles":[{"i":1,"title":"토론"}]}`;
  const parsed = extractLlmJsonObject(raw);
  assert.equal(parsed?.topicTitles?.[0]?.title, "토론");
});

test("extractLlmJsonObject returns null for non-JSON", () => {
  assert.equal(extractLlmJsonObject("서사만 한국어로 씁니다."), null);
});

test("extractLlmJsonObject ignores trailing braces after JSON", () => {
  const raw = `{"paragraphs":["본문"]} 참고: } 잡음`;
  const parsed = extractLlmJsonObject(raw);
  assert.equal(parsed?.paragraphs?.[0], "본문");
});
