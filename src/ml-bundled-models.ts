import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BUNDLED_EMBED_MODEL_ID,
  BUNDLED_SENTIMENT_MODEL_ID,
  BUNDLED_TOXICITY_MODEL_ID,
} from "./ml-bundle-ids.js";
import {
  isEmbedBundleReady,
  isSentimentBundleReady,
  isToxicityBundleReady,
  listMlModelRoots,
  resolveMlModelRootFor,
} from "./ml-bundle-cache.js";

const PKG_DATA_ML = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "data",
  "ml-models",
);

export {
  BUNDLED_EMBED_MODEL_ID,
  BUNDLED_SENTIMENT_MODEL_ID,
  BUNDLED_TOXICITY_MODEL_ID,
} from "./ml-bundle-ids.js";

/** transformers `env.localModelPath` — 해당 모델이 있는 첫 루트 */
export function bundledMlModelsDir(): string {
  for (const modelId of [
    BUNDLED_SENTIMENT_MODEL_ID,
    BUNDLED_EMBED_MODEL_ID,
    BUNDLED_TOXICITY_MODEL_ID,
  ]) {
    const root = resolveMlModelRootFor(modelId);
    if (root) return root;
  }
  const roots = listMlModelRoots();
  return roots[0] ?? PKG_DATA_ML;
}

export function bundledModelDir(modelId: string): string {
  const root = resolveMlModelRootFor(modelId) ?? bundledMlModelsDir();
  return join(root, modelId);
}

export function bundledSentimentModelDir(): string {
  return bundledModelDir(BUNDLED_SENTIMENT_MODEL_ID);
}

export function resolveBundledSentimentModelId(): string {
  return BUNDLED_SENTIMENT_MODEL_ID;
}

export function isBundledSentimentModelReady(): boolean {
  return isSentimentBundleReady();
}

export function isBundledEmbedModelReady(): boolean {
  return isEmbedBundleReady();
}

export function isBundledToxicityModelReady(): boolean {
  return isToxicityBundleReady();
}

/** 번들 ONNX가 있으면 transformers `env.localModelPath` 로 쓸 루트 */
export function bundledMlModelsRoot(): string | undefined {
  if (
    isBundledSentimentModelReady() ||
    isBundledEmbedModelReady() ||
    isBundledToxicityModelReady()
  ) {
    return bundledMlModelsDir();
  }
  return undefined;
}

export function isLocalBundledSentimentModel(modelId: string): boolean {
  return modelId === BUNDLED_SENTIMENT_MODEL_ID && isBundledSentimentModelReady();
}

export function isLocalBundledEmbedModel(modelId: string): boolean {
  return modelId === BUNDLED_EMBED_MODEL_ID && isBundledEmbedModelReady();
}

export function isLocalBundledToxicityModel(modelId: string): boolean {
  return modelId === BUNDLED_TOXICITY_MODEL_ID && isBundledToxicityModelReady();
}
