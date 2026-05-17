import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearHubTokensForPublicFetch,
  hubMirrorHosts,
  restoreHubTokens,
} from "../src/ml-hub-access.js";
import { sentimentModelFallbacks } from "../src/sentiment-policy.js";

describe("ml-hub-access", () => {
  it("clears hub tokens unless KCA_USE_HF_TOKEN=1", () => {
    const prev = process.env.HF_TOKEN;
    process.env.HF_TOKEN = "test-token";
    try {
      const saved = clearHubTokensForPublicFetch();
      assert.equal(process.env.HF_TOKEN, undefined);
      restoreHubTokens(saved);
      assert.equal(process.env.HF_TOKEN, "test-token");
    } finally {
      if (prev === undefined) delete process.env.HF_TOKEN;
      else process.env.HF_TOKEN = prev;
    }
  });

  it("hubMirrorHosts honors KCA_HF_MIRROR", () => {
    const prev = process.env.KCA_HF_MIRROR;
    process.env.KCA_HF_MIRROR = "https://example-mirror.test/hf";
    try {
      assert.deepEqual(hubMirrorHosts(), ["https://example-mirror.test/hf/"]);
    } finally {
      if (prev === undefined) delete process.env.KCA_HF_MIRROR;
      else process.env.KCA_HF_MIRROR = prev;
    }
  });
});

describe("sentiment fallbacks", () => {
  it("quality chain is default-only or bundled then default", () => {
    const chain = sentimentModelFallbacks("quality");
    assert.ok(chain.includes("Xenova/bert-base-multilingual-uncased-sentiment"));
    assert.ok(chain.length >= 1 && chain.length <= 2);
  });
});
