import assert from "node:assert/strict";
import test from "node:test";
import {
  KURE_ONNX_ASSET,
  listReleaseAssetUrls,
  mlModelsReleaseTag,
} from "../src/ml-bundle-cache.js";

test("listReleaseAssetUrls prefers API release with asset, keeps pinned fallback", async () => {
  const prevRelease = process.env.KCA_ML_MODELS_RELEASE;
  const prevFetch = globalThis.fetch;
  process.env.KCA_ML_MODELS_RELEASE = "ml-models-v9.9.9-test";
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify([
        {
          tag_name: "ml-models-v0.2.1",
          assets: [
            {
              name: KURE_ONNX_ASSET,
              browser_download_url: `https://github.com/claudianus/kakaotalk-chat-analyzer/releases/download/ml-models-v0.2.1/${KURE_ONNX_ASSET}`,
            },
          ],
        },
      ]),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as typeof fetch;
  try {
    const urls = await listReleaseAssetUrls(KURE_ONNX_ASSET);
    assert.ok(urls.length >= 2);
    assert.ok(urls[0]!.includes("ml-models-v0.2.1") && urls[0]!.endsWith(KURE_ONNX_ASSET));
    assert.ok(
      urls.some((u) => u.includes("ml-models-v9.9.9-test") && u.endsWith(KURE_ONNX_ASSET)),
    );
    assert.equal(mlModelsReleaseTag(), "ml-models-v9.9.9-test");
  } finally {
    globalThis.fetch = prevFetch;
    if (prevRelease === undefined) delete process.env.KCA_ML_MODELS_RELEASE;
    else process.env.KCA_ML_MODELS_RELEASE = prevRelease;
  }
});
