import assert from "node:assert/strict";
import test from "node:test";
import { isNoiseKeyword } from "../src/keyword-quality.js";
import { formatReplyGapMinutes } from "../src/report-util.js";

test("isNoiseKeyword filters digits and short latin tokens", () => {
  assert.equal(isNoiseKeyword("20"), true);
  assert.equal(isNoiseKeyword("kr"), true);
  assert.equal(isNoiseKeyword("ENT"), true);
  assert.equal(isNoiseKeyword("google_vignette"), true);
  assert.equal(isNoiseKeyword("클로드"), false);
  assert.equal(isNoiseKeyword("SaaS"), false);
});

test("formatReplyGapMinutes uses seconds under one minute", () => {
  assert.equal(formatReplyGapMinutes(0.1), "6초");
  assert.equal(formatReplyGapMinutes(0.5), "30초");
  assert.equal(formatReplyGapMinutes(2.3), "2.3분");
});
