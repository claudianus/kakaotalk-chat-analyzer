import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SENTIMENT_MODEL } from "../src/sentiment-policy.js";
import {
  assertDefaultSentimentHubAccessible,
  isSentimentHubBlocklisted,
  SENTIMENT_HUB_ANONYMOUS_BLOCKLIST,
} from "../src/sentiment-hub-registry.js";

describe("sentiment-hub-registry", () => {
  it("default model is not blocklisted", () => {
    assertDefaultSentimentHubAccessible();
    assert.equal(isSentimentHubBlocklisted(DEFAULT_SENTIMENT_MODEL), false);
  });

  it("legacy KLUE Xenova is blocklisted", () => {
    assert.ok(SENTIMENT_HUB_ANONYMOUS_BLOCKLIST.includes("Xenova/klue-roberta-small-sentiment"));
    assert.equal(isSentimentHubBlocklisted("Xenova/klue-roberta-small-sentiment"), true);
  });
});
