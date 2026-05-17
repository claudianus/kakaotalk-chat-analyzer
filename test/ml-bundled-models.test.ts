import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BUNDLED_SENTIMENT_MODEL_ID,
  bundledSentimentModelDir,
  isBundledSentimentModelReady,
  isLocalBundledSentimentModel,
} from "../src/ml-bundled-models.js";

describe("ml-bundled-models", () => {
  it("bundled dir path ends with model id", () => {
    assert.ok(bundledSentimentModelDir().endsWith(BUNDLED_SENTIMENT_MODEL_ID));
  });

  it("isLocalBundledSentimentModel requires ready artifacts", () => {
    const ready = isBundledSentimentModelReady();
    assert.equal(isLocalBundledSentimentModel(BUNDLED_SENTIMENT_MODEL_ID), ready);
    assert.equal(isLocalBundledSentimentModel("Xenova/bert-base-multilingual-uncased-sentiment"), false);
  });
});
