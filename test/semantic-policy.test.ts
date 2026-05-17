import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HeuristicPrepassCollector } from "../src/export-prepass.js";
import {
  DEFAULT_KOREAN_SEMANTIC_MODEL,
  formatTextForEmbedding,
  needsE5QueryPrefix,
  resolveSemanticKeywords,
  semanticEmbeddingModelId,
  semanticReservoirCap,
  semanticSampleCap,
} from "../src/semantic-policy.js";

describe("semantic-policy", () => {
  it("defaults to Xenova multilingual-e5-small", () => {
    const prev = process.env.KCA_SEMANTIC_MODEL;
    delete process.env.KCA_SEMANTIC_MODEL;
    try {
      assert.equal(semanticEmbeddingModelId(), DEFAULT_KOREAN_SEMANTIC_MODEL);
      assert.equal(DEFAULT_KOREAN_SEMANTIC_MODEL, "Xenova/multilingual-e5-small");
    } finally {
      if (prev === undefined) delete process.env.KCA_SEMANTIC_MODEL;
      else process.env.KCA_SEMANTIC_MODEL = prev;
    }
  });

  it("needsE5QueryPrefix for e5 models only", () => {
    assert.equal(needsE5QueryPrefix("Xenova/multilingual-e5-small"), true);
    assert.equal(needsE5QueryPrefix("dragonkue/multilingual-e5-small-ko"), true);
    assert.equal(needsE5QueryPrefix("nlpai-lab/KoE5"), true);
    assert.equal(needsE5QueryPrefix("Xenova/paraphrase-multilingual-MiniLM-L12-v2"), false);
  });

  it("semanticSampleCap scales with corpus size not drained sample count", () => {
    assert.equal(semanticSampleCap(93_042), 640);
    assert.equal(semanticSampleCap(720), 480);
    assert.equal(semanticSampleCap(100), 480);
    assert.equal(semanticReservoirCap(undefined), 640);
    assert.equal(semanticReservoirCap(93_042), 640);
    assert.equal(semanticReservoirCap(5_000), 480);
  });

  it("formatTextForEmbedding adds query prefix for e5", () => {
    assert.equal(formatTextForEmbedding("안녕", "Xenova/multilingual-e5-small"), "query: 안녕");
    assert.equal(
      formatTextForEmbedding("query: 이미 있음", "Xenova/multilingual-e5-small"),
      "query: 이미 있음",
    );
    assert.equal(
      formatTextForEmbedding("그대로", "Xenova/paraphrase-multilingual-MiniLM-L12-v2"),
      "그대로",
    );
  });

  it("KCA_SEMANTIC_DEFAULT=opt-in disables auto semantic", () => {
    const prev = process.env.KCA_SEMANTIC_DEFAULT;
    process.env.KCA_SEMANTIC_DEFAULT = "opt-in";
    const prepass = new HeuristicPrepassCollector();
    for (let i = 0; i < 60; i += 1) prepass.onMessageText("한국어 테스트 메시지입니다");
    try {
      assert.equal(resolveSemanticKeywords(undefined, prepass, prepass.sampleTexts()), false);
    } finally {
      if (prev === undefined) delete process.env.KCA_SEMANTIC_DEFAULT;
      else process.env.KCA_SEMANTIC_DEFAULT = prev;
    }
  });
});
