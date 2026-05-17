import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** `data/ml-models/` 하위 로컬 ONNX (transformers.js `localModelPath` 기준) */
export const BUNDLED_SENTIMENT_MODEL_ID = "kca-koelectra-korean-sentiment";

const PKG_DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data");

export function bundledMlModelsDir(): string {
  return join(PKG_DATA, "ml-models");
}

export function bundledSentimentModelDir(): string {
  return join(bundledMlModelsDir(), BUNDLED_SENTIMENT_MODEL_ID);
}

export function isBundledSentimentModelReady(): boolean {
  return existsSync(join(bundledSentimentModelDir(), "config.json"));
}

/** 번들 ONNX가 있으면 transformers `env.localModelPath` 로 쓸 루트 */
export function bundledMlModelsRoot(): string | undefined {
  return isBundledSentimentModelReady() ? bundledMlModelsDir() : undefined;
}

export function isLocalBundledSentimentModel(modelId: string): boolean {
  return modelId === BUNDLED_SENTIMENT_MODEL_ID && isBundledSentimentModelReady();
}
