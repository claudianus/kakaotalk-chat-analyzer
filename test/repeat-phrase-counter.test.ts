import assert from "node:assert/strict";
import test from "node:test";
import { RepeatPhraseCounter } from "../src/repeat-phrase-counter.js";

test("RepeatPhraseCounter tracks peakDate per phrase", () => {
  const c = new RepeatPhraseCounter();
  const phrase = "환영합니다 오픈채팅에 오신 것을";
  c.add(phrase, "2024-04-01");
  c.add(phrase, "2024-04-15");
  c.add(phrase, "2024-04-15");
  const top = c.top(1, 2);
  assert.equal(top[0]?.peakDate, "2024-04-15");
  assert.equal(top[0]?.count, 3);
});
