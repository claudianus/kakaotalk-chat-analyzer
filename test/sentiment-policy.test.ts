import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HeuristicPrepassCollector } from "../src/export-prepass.js";
import { BUNDLED_SENTIMENT_MODEL_ID, isBundledSentimentModelReady } from "../src/ml-bundled-models.js";
import { HUB_KOELECTRA_NSMC, HUB_KRELECTRA_NSMC } from "../src/ml/model-ids.js";
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
  it("uses KoELECTRA NSMC for all presets when bundle absent", () => {
    const prev = process.env.KCA_SENTIMENT_MODEL;
    delete process.env.KCA_SENTIMENT_MODEL;
    try {
      if (!isBundledSentimentModelReady()) {
        assert.equal(sentimentModelId("quality"), HUB_KOELECTRA_NSMC);
        assert.equal(sentimentModelId("speed"), HUB_KOELECTRA_NSMC);
      }
      assert.equal(DEFAULT_SENTIMENT_MODEL, HUB_KOELECTRA_NSMC);
    } finally {
      if (prev === undefined) delete process.env.KCA_SENTIMENT_MODEL;
      else process.env.KCA_SENTIMENT_MODEL = prev;
    }
  });

  it("prefers bundled nsmc when onnx present", () => {
    if (!isBundledSentimentModelReady()) return;
    assert.equal(sentimentModelId("quality"), BUNDLED_SENTIMENT_MODEL_ID);
    assert.equal(sentimentModelId("speed"), BUNDLED_SENTIMENT_MODEL_ID);
  });

  it("sentimentModelFallbacks chains bundle → KoELECTRA NSMC", () => {
    const chain = sentimentModelFallbacks("quality");
    if (isBundledSentimentModelReady()) {
      assert.deepEqual(chain, [BUNDLED_SENTIMENT_MODEL_ID, HUB_KOELECTRA_NSMC]);
    } else {
      assert.deepEqual(chain, [HUB_KOELECTRA_NSMC]);
    }
  });

  it("detects binary koelectra models", () => {
    assert.equal(isBinarySentimentModel(BUNDLED_SENTIMENT_MODEL_ID), true);
    assert.equal(isBinarySentimentModel(HUB_KOELECTRA_NSMC), true);
    assert.equal(isBinarySentimentModel("Xenova/bert-base-multilingual-uncased-sentiment"), false);
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
