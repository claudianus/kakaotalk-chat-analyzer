import { existsSync, mkdirSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
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

/** transformers `env.localModelPath` — 모든 루트 병합 디렉토리 우선 */
export function bundledMlModelsDir(): string {
  return mergedMlModelsDir();
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

let onnxSessionCwdChain: Promise<unknown> = Promise.resolve();

/** ORT external data는 model.onnx 기준 상대 경로 — 직렬화된 chdir */
export async function withBundledOnnxSessionCwd<T>(
  modelId: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!hasBundledOnnxExternalData(modelId)) return fn();
  const run = onnxSessionCwdChain.then(async () => {
    const onnxDir = join(bundledModelDir(modelId), "onnx");
    const prev = process.cwd();
    process.chdir(onnxDir);
    try {
      return await fn();
    } finally {
      process.chdir(prev);
    }
  });
  onnxSessionCwdChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run as Promise<T>;
}

let _mergedMlModelsDir: string | null = null;

/** 모든 모델 루트를 심볼릭 링크로 병합한 임시 디렉토리 — localModelPath가 하나의 경로에서 모든 모델을 찾을 수 있도록 */
export function mergedMlModelsDir(): string {
  if (_mergedMlModelsDir) return _mergedMlModelsDir;

  const tmpDir = join(tmpdir(), `kca-ml-models-${process.pid}`);
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });

  for (const root of listMlModelRoots()) {
    let entries: { name: string; isDirectory(): boolean }[];
    try {
      entries = readdirSync(root, { withFileTypes: true }) as unknown as { name: string; isDirectory(): boolean }[];
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const src = join(root, entry.name);
      const dest = join(tmpDir, entry.name);
      if (existsSync(dest)) continue; // 첫 번째 루트 우선
      try {
        symlinkSync(src, dest);
      } catch {
        // 심볼릭 링크 실패 시 skip (Windows 비관리자 등)
      }
    }
  }

  _mergedMlModelsDir = tmpDir;
  return tmpDir;
}

/** 번들 ONNX가 있으면 transformers `env.localModelPath` 로 쓸 루트 — 병합 디렉토리 우선 */
export function bundledMlModelsRoot(): string | undefined {
  if (
    isBundledSentimentModelReady() ||
    isBundledEmbedModelReady() ||
    isBundledToxicityModelReady() ||
    isBundledKureModelReady()
  ) {
    return mergedMlModelsDir();
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
