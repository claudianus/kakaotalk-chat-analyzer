import { BUNDLED_EMBED_MODEL_ID, BUNDLED_SENTIMENT_MODEL_ID, BUNDLED_TOXICITY_MODEL_ID, isBundledEmbedModelReady, isBundledSentimentModelReady, isBundledToxicityModelReady, resolveBundledSentimentModelId, } from "../ml-bundled-models.js";
import { DEFAULT_SENTIMENT_MODEL } from "../sentiment-policy.js";
import { DEFAULT_KOREAN_SEMANTIC_MODEL, QUALITY_KOREAN_SEMANTIC_MODEL, } from "../semantic-policy.js";
export const ML_MODEL_REGISTRY = {
    sentiment: {
        task: "sentiment",
        bundledId: BUNDLED_SENTIMENT_MODEL_ID,
        hubFallback: DEFAULT_SENTIMENT_MODEL,
        hubTask: "text-classification",
    },
    embedding: {
        task: "embedding",
        bundledId: BUNDLED_EMBED_MODEL_ID,
        hubFallback: QUALITY_KOREAN_SEMANTIC_MODEL,
        hubTask: "feature-extraction",
    },
    toxicity: {
        task: "toxicity",
        bundledId: BUNDLED_TOXICITY_MODEL_ID,
        hubFallback: "Xenova/bert-base-multilingual-uncased-sentiment",
        hubTask: "text-classification",
    },
};
export function isBundledModelReady(task) {
    if (task === "sentiment")
        return isBundledSentimentModelReady();
    if (task === "embedding")
        return isBundledEmbedModelReady();
    return isBundledToxicityModelReady();
}
/** quality preset sentiment: 번들 id (레거시 디렉터리 포함) */
export function resolveSentimentBundledId() {
    return resolveBundledSentimentModelId();
}
/** quality preset embedding: 번들 KoELECTRA 또는 E5 Hub */
export function resolveEmbeddingModelId(preset) {
    const env = process.env.KCA_SEMANTIC_MODEL?.trim();
    if (env)
        return env;
    if (preset === "quality" && isBundledEmbedModelReady())
        return BUNDLED_EMBED_MODEL_ID;
    if (preset === "quality")
        return QUALITY_KOREAN_SEMANTIC_MODEL;
    return DEFAULT_KOREAN_SEMANTIC_MODEL;
}
export function resolveToxicityModelId() {
    const env = process.env.KCA_TOXICITY_MODEL?.trim();
    if (env)
        return env;
    if (isBundledToxicityModelReady())
        return BUNDLED_TOXICITY_MODEL_ID;
    return "";
}
//# sourceMappingURL=registry.js.map