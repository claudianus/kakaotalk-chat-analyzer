import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HUB_KOELECTRA_NSMC } from "../src/ml/model-ids.js";
import { DEFAULT_SENTIMENT_MODEL } from "../src/sentiment-policy.js";
import {
  SENTIMENT_HUB_ANONYMOUS_BLOCKLIST,
  assertDefaultSentimentHubAccessible,
  isSentimentHubBlocklisted,
} from "../src/sentiment-hub-registry.js";

describe("sentiment-hub-registry", () => {
  it("default model is NSMC and not blocklisted", () => {
    assert.equal(DEFAULT_SENTIMENT_MODEL, HUB_KOELECTRA_NSMC);
    assert.equal(isSentimentHubBlocklisted(DEFAULT_SENTIMENT_MODEL), false);
    assert.doesNotThrow(() => assertDefaultSentimentHubAccessible());
  });

  it("legacy Xenova sentiment models are blocklisted", () => {
    assert.ok(SENTIMENT_HUB_ANONYMOUS_BLOCKLIST.includes("Xenova/klue-roberta-small-sentiment"));
    assert.ok(SENTIMENT_HUB_ANONYMOUS_BLOCKLIST.includes("Xenova/bert-base-multilingual-uncased-sentiment"));
    assert.equal(isSentimentHubBlocklisted("Xenova/klue-roberta-small-sentiment"), true);
  });
});
