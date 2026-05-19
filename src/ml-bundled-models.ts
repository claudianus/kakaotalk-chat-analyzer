import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BUNDLED_EMBED_MODEL_ID,
  BUNDLED_KURE_MODEL_ID,
  BUNDLED_SENTIMENT_MODEL_ID,
  BUNDLED_TOXICITY_MODEL_ID,
} from "./ml-bundle-ids.js";
import {
  isEmbedBundleReady,
  isKureBundleReady,
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
  BUNDLED_KURE_MODEL_ID,
  BUNDLED_SENTIMENT_MODEL_ID,
  BUNDLED_TOXICITY_MODEL_ID,
} from "./ml-bundle-ids.js";

/** transformers `env.localModelPath` — 코어 번들(NSMC+embed)이 함께 있는 루트 우선 */
export function bundledMlModelsDir(): string {
  for (const root of listMlModelRoots()) {
    const sent = join(root, BUNDLED_SENTIMENT_MODEL_ID, "onnx", "model.onnx");
    const embed = join(root, BUNDLED_EMBED_MODEL_ID, "onnx", "model.onnx");
    if (existsSync(sent) && existsSync(embed)) return root;
  }
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

export function isBundledKureModelReady(): boolean {
  return isKureBundleReady();
}

/** ONNX 외부 가중치(model.onnx_data) — 세션 cwd를 onnx/ 로 맞춤 */
export function hasBundledOnnxExternalData(modelId: string): boolean {
  return existsSync(join(bundledModelDir(modelId), "onnx", "model.onnx_data"));
}

export async function withBundledOnnxSessionCwd<T>(
  modelId: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!hasBundledOnnxExternalData(modelId)) return fn();
  const onnxDir = join(bundledModelDir(modelId), "onnx");
  const prev = process.cwd();
  process.chdir(onnxDir);
  try {
    return await fn();
  } finally {
    process.chdir(prev);
  }
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

export function isLocalBundledKureModel(modelId: string): boolean {
  return modelId === BUNDLED_KURE_MODEL_ID && isBundledKureModelReady();
}
