import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BUNDLED_EMBED_MODEL_ID, BUNDLED_SENTIMENT_MODEL_ID, BUNDLED_TOXICITY_MODEL_ID, } from "./ml-bundle-ids.js";
import { isEmbedBundleReady, isSentimentBundleReady, isToxicityBundleReady, listMlModelRoots, resolveMlModelRootFor, } from "./ml-bundle-cache.js";
const PKG_DATA_ML = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "ml-models");
export { BUNDLED_EMBED_MODEL_ID, BUNDLED_SENTIMENT_MODEL_ID, BUNDLED_TOXICITY_MODEL_ID, } from "./ml-bundle-ids.js";
/** transformers `env.localModelPath` — 코어 번들(NSMC+embed)이 함께 있는 루트 우선 */
export function bundledMlModelsDir() {
    for (const root of listMlModelRoots()) {
        const sent = join(root, BUNDLED_SENTIMENT_MODEL_ID, "onnx", "model.onnx");
        const embed = join(root, BUNDLED_EMBED_MODEL_ID, "onnx", "model.onnx");
        if (existsSync(sent) && existsSync(embed))
            return root;
    }
    for (const modelId of [
        BUNDLED_SENTIMENT_MODEL_ID,
        BUNDLED_EMBED_MODEL_ID,
        BUNDLED_TOXICITY_MODEL_ID,
    ]) {
        const root = resolveMlModelRootFor(modelId);
        if (root)
            return root;
    }
    const roots = listMlModelRoots();
    return roots[0] ?? PKG_DATA_ML;
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
export function isBundledToxicityModelReady() {
    return isToxicityBundleReady();
}
/** 번들 ONNX가 있으면 transformers `env.localModelPath` 로 쓸 루트 */
export function bundledMlModelsRoot() {
    if (isBundledSentimentModelReady() ||
        isBundledEmbedModelReady() ||
        isBundledToxicityModelReady()) {
        return bundledMlModelsDir();
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
//# sourceMappingURL=ml-bundled-models.js.map