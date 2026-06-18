import assert from "node:assert/strict";
import test from "node:test";
import { isAiSlopText } from "../src/llm-slop.js";
import { isLlmGarbageText } from "../src/llm-deck-validate.js";

test("isAiSlopText catches Korean and English slop", () => {
  assert.equal(isAiSlopText("흥미롭게도 이 방은 활발합니다"), true);
  assert.equal(isAiSlopText("Let's delve into the tapestry of conversation"), true);
  assert.equal(isAiSlopText("클로드와 코덱스가 자주 나옵니다"), false);
});

test("isLlmGarbageText rejects slop via isAiSlopText", () => {
  assert.equal(isLlmGarbageText("활발한 소통의 장입니다"), true);
  assert.equal(isLlmGarbageText("메시지 1200건"), false);
});
