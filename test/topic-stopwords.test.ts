import assert from "node:assert/strict";
import test from "node:test";
import { filterMeaningfulTopicTerms, isTopicDiscourse } from "../src/topic-stopwords.js";
import { buildTopicStopwords } from "../src/topic-stopwords.js";

test("isTopicDiscourse filters filler terms", () => {
  assert.equal(isTopicDiscourse("그런거"), true);
  assert.equal(isTopicDiscourse("클로드"), false);
});

test("filterMeaningfulTopicTerms removes discourse and stopwords", () => {
  const stop = buildTopicStopwords();
  const out = filterMeaningfulTopicTerms(["그런거", "있어요", "클로드", "개발"], stop);
  assert.deepEqual(out, ["클로드", "개발"]);
});
