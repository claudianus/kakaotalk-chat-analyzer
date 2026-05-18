import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HeuristicPrepassCollector } from "../src/export-prepass.js";
import { BUNDLED_SENTIMENT_MODEL_ID, isBundledSentimentModelReady } from "../src/ml-bundled-models.js";
import {
  DEFAULT_SENTIMENT_MODEL,
  isBinarySentimentModel,
  resolveSentiment,
  sentimentModelFallbacks,
  sentimentModelId,
  sentimentSampleCap,
  subsampleSentimentRecords,
} from "../src/sentiment-policy.js";

describe("sentiment-policy", () => {
  it("uses default accessible model for all presets when bundle absent", () => {
    const prev = process.env.KCA_SENTIMENT_MODEL;
    delete process.env.KCA_SENTIMENT_MODEL;
    try {
      assert.equal(sentimentModelId("quality"), DEFAULT_SENTIMENT_MODEL);
      assert.equal(sentimentModelId(undefined, 95_000, { preset: "quality" }), DEFAULT_SENTIMENT_MODEL);
      assert.equal(sentimentModelId("speed"), DEFAULT_SENTIMENT_MODEL);
    } finally {
      if (prev === undefined) delete process.env.KCA_SENTIMENT_MODEL;
      else process.env.KCA_SENTIMENT_MODEL = prev;
    }
  });

  it("quality prefers bundled koelectra when onnx present", () => {
    if (!isBundledSentimentModelReady()) return;
    assert.equal(sentimentModelId("quality"), BUNDLED_SENTIMENT_MODEL_ID);
  });

  it("defaults to accessible multilingual uncased sentiment model", () => {
    const prev = process.env.KCA_SENTIMENT_MODEL;
    delete process.env.KCA_SENTIMENT_MODEL;
    try {
      assert.equal(sentimentModelId(), DEFAULT_SENTIMENT_MODEL);
    } finally {
      if (prev === undefined) delete process.env.KCA_SENTIMENT_MODEL;
      else process.env.KCA_SENTIMENT_MODEL = prev;
    }
  });

  it("sentimentModelFallbacks is single entry when primary is default", () => {
    const chain = sentimentModelFallbacks("quality");
    if (chain[0] === DEFAULT_SENTIMENT_MODEL) {
      assert.deepEqual(chain, [DEFAULT_SENTIMENT_MODEL]);
    } else {
      assert.deepEqual(chain, [BUNDLED_SENTIMENT_MODEL_ID, DEFAULT_SENTIMENT_MODEL]);
    }
  });

  it("detects binary koelectra models", () => {
    assert.equal(isBinarySentimentModel(BUNDLED_SENTIMENT_MODEL_ID), true);
    assert.equal(isBinarySentimentModel("cringepnh/koelectra-korean-sentiment"), true);
    assert.equal(isBinarySentimentModel(DEFAULT_SENTIMENT_MODEL), false);
  });

  it("sentimentSampleCap matches semantic tiers", () => {
    assert.equal(sentimentSampleCap(120_000), 2_000);
    assert.equal(sentimentSampleCap(720), 480);
  });

  it("subsampleSentimentRecords is deterministic", () => {
    const rows = [
      { text: "a".repeat(20), sender: "x" },
      { text: "b".repeat(20), sender: "y" },
      { text: "c".repeat(20), sender: "z" },
      { text: "d".repeat(20), sender: "w" },
    ];
    assert.deepEqual(subsampleSentimentRecords(rows, 2), subsampleSentimentRecords(rows, 2));
    assert.equal(subsampleSentimentRecords(rows, 2).length, 2);
  });

  it("resolveSentiment respects opt-out env", () => {
    const prepass = new HeuristicPrepassCollector();
    for (let i = 0; i < 50; i += 1) prepass.onMessageText("한국어 메시지입니다");
    const prev = process.env.KCA_NO_SENTIMENT;
    process.env.KCA_NO_SENTIMENT = "1";
    try {
      assert.equal(resolveSentiment(undefined, prepass, prepass.sampleTexts()), false);
    } finally {
      if (prev === undefined) delete process.env.KCA_NO_SENTIMENT;
      else process.env.KCA_NO_SENTIMENT = prev;
    }
  });
});
