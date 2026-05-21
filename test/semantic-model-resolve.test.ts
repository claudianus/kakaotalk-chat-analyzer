import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveBundledSemanticModelId,
  resolveDefaultSemanticHubId,
  shouldPreferBundledKure,
  shouldPreferBundledSemanticPolicy,
} from "../src/semantic-model-resolve.js";
import { BUNDLED_EMBED_MODEL_ID, BUNDLED_GRANITE_EMBED_MODEL_ID, BUNDLED_KURE_MODEL_ID } from "../src/ml-bundle-ids.js";
import {
  HUB_GRANITE_EMBED_97M,
  HUB_GRANITE_EMBED_311M,
  HUB_KOELECTRA_KORSTS,
} from "../src/ml/model-ids.js";

test("resolveDefaultSemanticHubId tiers by preset and RAM", () => {
  assert.equal(resolveDefaultSemanticHubId("balanced", 12), HUB_KOELECTRA_KORSTS);
  assert.equal(resolveDefaultSemanticHubId("balanced", 16), HUB_GRANITE_EMBED_97M);
  assert.equal(resolveDefaultSemanticHubId("quality", 12), HUB_GRANITE_EMBED_97M);
  assert.equal(resolveDefaultSemanticHubId("ultra", 20), HUB_GRANITE_EMBED_311M);
});

test("shouldPreferBundledKure legacy mode only", () => {
  const prevLegacy = process.env.KCA_LEGACY_MODELS;
  const prevDl = process.env.KCA_NO_KURE_DOWNLOAD;
  delete process.env.KCA_NO_KURE_DOWNLOAD;
  try {
    // Granite 번들이 있으면 quality/ultra에서 Granite 우선
    assert.equal(shouldPreferBundledKure("ultra", 16), false);
    assert.equal(resolveBundledSemanticModelId("ultra", 16), BUNDLED_GRANITE_EMBED_MODEL_ID);

    // 레거시 모드 on → KURE 활성 (Granite 없을 때)
    process.env.KCA_LEGACY_MODELS = "1";
    assert.equal(shouldPreferBundledKure("ultra", 16), true);
    assert.equal(shouldPreferBundledKure("quality", 14), true);
    assert.equal(shouldPreferBundledKure("balanced", 20), false);
    assert.equal(shouldPreferBundledKure("ultra", 12), false);
    assert.equal(resolveBundledSemanticModelId("ultra", 16), BUNDLED_GRANITE_EMBED_MODEL_ID);
    assert.equal(resolveBundledSemanticModelId("speed", 20), BUNDLED_EMBED_MODEL_ID);
  } finally {
    if (prevLegacy === undefined) delete process.env.KCA_LEGACY_MODELS;
    else process.env.KCA_LEGACY_MODELS = prevLegacy;
    if (prevDl === undefined) delete process.env.KCA_NO_KURE_DOWNLOAD;
    else process.env.KCA_NO_KURE_DOWNLOAD = prevDl;
  }
});

test("shouldPreferBundledSemanticPolicy keeps bundle on ultra and defers hub on ample balanced RAM", () => {
  const prev = process.env.KCA_PREFER_BUNDLED_SEMANTIC;
  delete process.env.KCA_PREFER_BUNDLED_SEMANTIC;
  try {
    assert.equal(shouldPreferBundledSemanticPolicy("ultra", 20), true);
    assert.equal(shouldPreferBundledSemanticPolicy("balanced", 16), false);
    assert.equal(shouldPreferBundledSemanticPolicy("balanced", 12), true);
  } finally {
    if (prev === undefined) delete process.env.KCA_PREFER_BUNDLED_SEMANTIC;
    else process.env.KCA_PREFER_BUNDLED_SEMANTIC = prev;
  }
});
