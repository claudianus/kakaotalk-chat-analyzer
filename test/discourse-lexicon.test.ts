import assert from "node:assert/strict";
import test from "node:test";
import { discourseRatio, isDiscourseTerm } from "../src/discourse-lexicon.js";

test("isDiscourseTerm flags BrewPage noise tokens", () => {
  for (const w of ["요즘", "시간", "부탁", "환영", "있어요", "그런거", "감사합니다", "한데"]) {
    assert.equal(isDiscourseTerm(w), true, w);
  }
  assert.equal(isDiscourseTerm("클로드"), false);
  assert.equal(isDiscourseTerm("코덱스"), false);
});

test("discourseRatio measures term set quality", () => {
  assert.ok(discourseRatio(["있어서", "기억", "클로드"]) > 0.5);
  assert.ok(discourseRatio(["클로드", "코덱스", "개발"]) < 0.34);
});
