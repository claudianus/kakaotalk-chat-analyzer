import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HeuristicPrepassCollector } from "../src/export-prepass.js";
import { BUNDLED_EMBED_MODEL_ID, isBundledEmbedModelReady } from "../src/ml-bundled-models.js";
import { HUB_KOELECTRA_EMBED, HUB_KOELECTRA_KORSTS, HUB_KOREAN_KURE_V1 } from "../src/ml/model-ids.js";
import { resolveDefaultSemanticHubId, shouldPreferBundledSemantic } from "../src/semantic-model-resolve.js";
import {
  DEFAULT_KOREAN_SEMANTIC_MODEL,
  QUALITY_KOREAN_SEMANTIC_MODEL,
  formatTextForEmbedding,
  needsE5QueryPrefix,
  resolveSemanticKeywords,
  semanticEmbeddingModelId,
  semanticReservoirCap,
  semanticSampleCap,
  subsampleSemanticMessages,
} from "../src/semantic-policy.js";

describe("semantic-policy", () => {
  it("defaults to KorSTS Hub for balanced when bundle absent", () => {
    const prev = process.env.KCA_SEMANTIC_MODEL;
    delete process.env.KCA_SEMANTIC_MODEL;
    try {
      if (!isBundledEmbedModelReady()) {
        assert.equal(semanticEmbeddingModelId(), HUB_KOELECTRA_KORSTS);
        assert.equal(semanticEmbeddingModelId({ preset: "balanced" }), HUB_KOELECTRA_KORSTS);
        assert.equal(DEFAULT_KOREAN_SEMANTIC_MODEL, HUB_KOELECTRA_KORSTS);
      }
    } finally {
      if (prev === undefined) delete process.env.KCA_SEMANTIC_MODEL;
      else process.env.KCA_SEMANTIC_MODEL = prev;
    }
  });

  it("quality and ultra presets select KoELECTRA embed Hub when bundle absent", () => {
    const prevModel = process.env.KCA_SEMANTIC_MODEL;
    delete process.env.KCA_SEMANTIC_MODEL;
    try {
      if (!isBundledEmbedModelReady()) {
        assert.equal(resolveDefaultSemanticHubId("quality", 14), HUB_KOELECTRA_EMBED);
        assert.equal(resolveDefaultSemanticHubId("ultra", 20), HUB_KOELECTRA_EMBED);
        assert.equal(QUALITY_KOREAN_SEMANTIC_MODEL, HUB_KOELECTRA_EMBED);
      }
    } finally {
      if (prevModel === undefined) delete process.env.KCA_SEMANTIC_MODEL;
      else process.env.KCA_SEMANTIC_MODEL = prevModel;
    }
  });

  it("prefers bundled embed when RAM below hub tier", () => {
    if (!isBundledEmbedModelReady()) return;
    assert.equal(shouldPreferBundledSemantic("balanced", 12), true);
    assert.equal(shouldPreferBundledSemantic("quality", 12), true);
    assert.equal(shouldPreferBundledSemantic("ultra", 12), true);
    assert.equal(shouldPreferBundledSemantic("quality", 16), true);
  });

  it("needsE5QueryPrefix is false for KoELECTRA", () => {
    assert.equal(needsE5QueryPrefix(HUB_KOELECTRA_KORSTS), false);
    assert.equal(needsE5QueryPrefix(HUB_KOELECTRA_EMBED), false);
    assert.equal(needsE5QueryPrefix(BUNDLED_EMBED_MODEL_ID), false);
    assert.equal(needsE5QueryPrefix("Xenova/multilingual-e5-small"), true);
    assert.equal(needsE5QueryPrefix("nlpai-lab/KURE-v1"), true);
    assert.equal(needsE5QueryPrefix("BAAI/bge-m3"), true);
  });

  it("semanticSampleCap scales with corpus size", () => {
    assert.equal(semanticSampleCap(150_000), 2_000);
    assert.equal(semanticSampleCap(93_042), 1_200);
    assert.equal(semanticSampleCap(25_000), 800);
    assert.equal(semanticSampleCap(720), 480);
    assert.equal(semanticReservoirCap(undefined), 2_000);
  });

  it("subsampleSemanticMessages is deterministic", () => {
    const msgs = ["a".repeat(20), "b".repeat(20), "c".repeat(20), "d".repeat(20)];
    const a = subsampleSemanticMessages(msgs, 2);
    const b = subsampleSemanticMessages(msgs, 2);
    assert.deepEqual(a, b);
    assert.equal(a.length, 2);
  });

  it("formatTextForEmbedding leaves KoELECTRA text unchanged", () => {
    assert.equal(formatTextForEmbedding("안녕", HUB_KOELECTRA_KORSTS), "안녕");
    assert.equal(formatTextForEmbedding("안녕", "Xenova/multilingual-e5-small"), "query: 안녕");
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
