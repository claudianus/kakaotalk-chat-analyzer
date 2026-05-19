import assert from "node:assert/strict";
import test from "node:test";
import { disposeUtteranceMlPipelines } from "../src/ml-dispose.js";
import { disposeSemanticPipeline } from "../src/semantic-keywords.js";
import { disposeSentimentPipeline } from "../src/sentiment-analyze.js";
import { disposeToxicityPipeline } from "../src/toxicity-analyze.js";

test("disposeUtteranceMlPipelines resolves when pipelines idle", async () => {
  await assert.doesNotReject(disposeUtteranceMlPipelines());
});

test("individual ML dispose hooks resolve when idle", async () => {
  await assert.doesNotReject(disposeSemanticPipeline());
  await assert.doesNotReject(disposeSentimentPipeline());
  await assert.doesNotReject(disposeToxicityPipeline());
});
