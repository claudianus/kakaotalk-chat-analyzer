import assert from "node:assert/strict";
import test from "node:test";
import {
  KURE_ONNX_ASSET,
  listReleaseAssetUrls,
  mlModelsReleaseTag,
} from "../src/ml-bundle-cache.js";

test("listReleaseAssetUrls includes pinned ml-models release URL", async () => {
  const prev = process.env.KCA_ML_MODELS_RELEASE;
  process.env.KCA_ML_MODELS_RELEASE = "ml-models-v9.9.9-test";
  try {
    const urls = await listReleaseAssetUrls(KURE_ONNX_ASSET);
    assert.ok(urls.length >= 1);
    assert.ok(
      urls[0]!.includes("ml-models-v9.9.9-test") && urls[0]!.endsWith(KURE_ONNX_ASSET),
    );
    assert.equal(mlModelsReleaseTag(), "ml-models-v9.9.9-test");
  } finally {
    if (prev === undefined) delete process.env.KCA_ML_MODELS_RELEASE;
    else process.env.KCA_ML_MODELS_RELEASE = prev;
  }
});
