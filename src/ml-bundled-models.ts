import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** NSMC KoELECTRA-Small (quality sentiment) */
export const BUNDLED_SENTIMENT_MODEL_ID = "kca-koelectra-small-v3-nsmc";

/** 이전 번들 디렉터리(호환) */
export const LEGACY_BUNDLED_SENTIMENT_MODEL_ID = "kca-koelectra-korean-sentiment";

/** KorSTS / semantic quality embedding */
export const BUNDLED_EMBED_MODEL_ID = "kca-koelectra-small-v3-embed";

/** KcELECTRA-base toxicity (optional, large) */
export const BUNDLED_TOXICITY_MODEL_ID = "kca-kcelectra-base-toxicity";

const PKG_DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data");

function tryModelsPackageMlDir(): string | undefined {
  try {
    const req = createRequire(import.meta.url);
    const pkgJson = req.resolve("kakaotalk-chat-analyzer-models/package.json");
    const dir = join(dirname(pkgJson), "data", "ml-models");
    if (existsSync(dir)) return dir;
  } catch {
    /* optional package not installed */
  }
  return undefined;
}

/** `data/ml-models/` — optional npm models 패키지 우선 */
export function bundledMlModelsDir(): string {
  const fromPkg = tryModelsPackageMlDir();
  if (fromPkg) return fromPkg;
  return join(PKG_DATA, "ml-models");
}

export function bundledModelDir(modelId: string): string {
  return join(bundledMlModelsDir(), modelId);
}

export function bundledSentimentModelDir(): string {
  return bundledModelDir(resolveBundledSentimentModelId());
}

function modelConfigExists(modelId: string): boolean {
  return existsSync(join(bundledMlModelsDir(), modelId, "config.json"));
}

export function resolveBundledSentimentModelId(): string {
  if (modelConfigExists(BUNDLED_SENTIMENT_MODEL_ID)) return BUNDLED_SENTIMENT_MODEL_ID;
  if (modelConfigExists(LEGACY_BUNDLED_SENTIMENT_MODEL_ID)) return LEGACY_BUNDLED_SENTIMENT_MODEL_ID;
  return BUNDLED_SENTIMENT_MODEL_ID;
}

export function isBundledSentimentModelReady(): boolean {
  return (
    modelConfigExists(BUNDLED_SENTIMENT_MODEL_ID) ||
    modelConfigExists(LEGACY_BUNDLED_SENTIMENT_MODEL_ID)
  );
}

export function isBundledEmbedModelReady(): boolean {
  return modelConfigExists(BUNDLED_EMBED_MODEL_ID);
}

export function isBundledToxicityModelReady(): boolean {
  return modelConfigExists(BUNDLED_TOXICITY_MODEL_ID);
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
  if (!isBundledSentimentModelReady()) return false;
  return (
    modelId === BUNDLED_SENTIMENT_MODEL_ID ||
    modelId === LEGACY_BUNDLED_SENTIMENT_MODEL_ID ||
    modelId === resolveBundledSentimentModelId()
  );
}

export function isLocalBundledEmbedModel(modelId: string): boolean {
  return modelId === BUNDLED_EMBED_MODEL_ID && isBundledEmbedModelReady();
}

export function isLocalBundledToxicityModel(modelId: string): boolean {
  return modelId === BUNDLED_TOXICITY_MODEL_ID && isBundledToxicityModelReady();
}
