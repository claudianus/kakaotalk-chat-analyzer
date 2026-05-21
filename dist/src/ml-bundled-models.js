import { existsSync, mkdirSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BUNDLED_EMBED_MODEL_ID, BUNDLED_GRANITE_EMBED_MODEL_ID, BUNDLED_KURE_MODEL_ID, BUNDLED_SENTIMENT_MODEL_ID, BUNDLED_TOXICITY_MODEL_ID, } from "./ml-bundle-ids.js";
import { isEmbedBundleReady, isGraniteEmbedBundleReady, isKureBundleReady, isSentimentBundleReady, isToxicityBundleReady, listMlModelRoots, resolveMlModelRootFor, } from "./ml-bundle-cache.js";
const PKG_DATA_ML = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "ml-models");
export { BUNDLED_EMBED_MODEL_ID, BUNDLED_GRANITE_EMBED_MODEL_ID, BUNDLED_KURE_MODEL_ID, BUNDLED_SENTIMENT_MODEL_ID, BUNDLED_TOXICITY_MODEL_ID, } from "./ml-bundle-ids.js";
/** transformers `env.localModelPath` — 모든 루트 병합 디렉토리 우선 */
export function bundledMlModelsDir() {
    return mergedMlModelsDir();
}
export function bundledModelDir(modelId) {
    const root = resolveMlModelRootFor(modelId) ?? bundledMlModelsDir();
    return join(root, modelId);
}
export function bundledSentimentModelDir() {
    return bundledModelDir(BUNDLED_SENTIMENT_MODEL_ID);
}
export function resolveBundledSentimentModelId() {
    return BUNDLED_SENTIMENT_MODEL_ID;
}
export function isBundledSentimentModelReady() {
    return isSentimentBundleReady();
}
export function isBundledEmbedModelReady() {
    return isEmbedBundleReady();
}
export function isBundledGraniteEmbedModelReady() {
    return isGraniteEmbedBundleReady();
}
export function isBundledToxicityModelReady() {
    return isToxicityBundleReady();
}
export function isBundledKureModelReady() {
    return isKureBundleReady();
}
/** ONNX 외부 가중치(model.onnx_data) — 세션 cwd를 onnx/ 로 맞춤 */
export function hasBundledOnnxExternalData(modelId) {
    return existsSync(join(bundledModelDir(modelId), "onnx", "model.onnx_data"));
}
let onnxSessionCwdChain = Promise.resolve();
/** ORT external data는 model.onnx 기준 상대 경로 — 직렬화된 chdir */
export async function withBundledOnnxSessionCwd(modelId, fn) {
    if (!hasBundledOnnxExternalData(modelId))
        return fn();
    const run = onnxSessionCwdChain.then(async () => {
        const onnxDir = join(bundledModelDir(modelId), "onnx");
        const prev = process.cwd();
        process.chdir(onnxDir);
        try {
            return await fn();
        }
        finally {
            process.chdir(prev);
        }
    });
    onnxSessionCwdChain = run.then(() => undefined, () => undefined);
    return run;
}
let _mergedMlModelsDir = null;
/** 모든 모델 루트를 심볼릭 링크로 병합한 임시 디렉토리 — localModelPath가 하나의 경로에서 모든 모델을 찾을 수 있도록 */
export function mergedMlModelsDir() {
    if (_mergedMlModelsDir)
        return _mergedMlModelsDir;
    const tmpDir = join(tmpdir(), `kca-ml-models-${process.pid}`);
    if (existsSync(tmpDir))
        rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
    for (const root of listMlModelRoots()) {
        let entries;
        try {
            entries = readdirSync(root, { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            const src = join(root, entry.name);
            const dest = join(tmpDir, entry.name);
            if (existsSync(dest))
                continue; // 첫 번째 루트 우선
            try {
                symlinkSync(src, dest);
            }
            catch {
                // 심볼릭 링크 실패 시 skip (Windows 비관리자 등)
            }
        }
    }
    _mergedMlModelsDir = tmpDir;
    return tmpDir;
}
/** 번들 ONNX가 있으면 transformers `env.localModelPath` 로 쓸 루트 — 병합 디렉토리 우선 */
export function bundledMlModelsRoot() {
    if (isBundledSentimentModelReady() ||
        isBundledEmbedModelReady() ||
        isBundledGraniteEmbedModelReady() ||
        isBundledToxicityModelReady() ||
        isBundledKureModelReady()) {
        return mergedMlModelsDir();
    }
    return undefined;
}
export function isLocalBundledSentimentModel(modelId) {
    return modelId === BUNDLED_SENTIMENT_MODEL_ID && isBundledSentimentModelReady();
}
export function isLocalBundledEmbedModel(modelId) {
    return modelId === BUNDLED_EMBED_MODEL_ID && isBundledEmbedModelReady();
}
export function isLocalBundledToxicityModel(modelId) {
    return modelId === BUNDLED_TOXICITY_MODEL_ID && isBundledToxicityModelReady();
}
export function isLocalBundledKureModel(modelId) {
    return modelId === BUNDLED_KURE_MODEL_ID && isBundledKureModelReady();
}
export function isLocalBundledGraniteEmbedModel(modelId) {
    return modelId === BUNDLED_GRANITE_EMBED_MODEL_ID && isBundledGraniteEmbedModelReady();
}
//# sourceMappingURL=ml-bundled-models.js.map