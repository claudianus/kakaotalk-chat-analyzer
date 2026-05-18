import { BUNDLED_EMBED_MODEL_ID, BUNDLED_SENTIMENT_MODEL_ID, BUNDLED_TOXICITY_MODEL_ID, isBundledEmbedModelReady, isBundledSentimentModelReady, isBundledToxicityModelReady, resolveBundledSentimentModelId, } from "../ml-bundled-models.js";
import { HUB_KCELECTRA_TOXICITY, HUB_KOELECTRA_EMBED, HUB_KOELECTRA_KORSTS, HUB_KOELECTRA_NSMC, } from "./model-ids.js";
export const ML_MODEL_REGISTRY = {
    sentiment: {
        task: "sentiment",
        bundledId: BUNDLED_SENTIMENT_MODEL_ID,
        hubFallback: HUB_KOELECTRA_NSMC,
        hubTask: "text-classification",
    },
    embedding: {
        task: "embedding",
        bundledId: BUNDLED_EMBED_MODEL_ID,
        hubFallback: HUB_KOELECTRA_EMBED,
        hubTask: "feature-extraction",
    },
    toxicity: {
        task: "toxicity",
        bundledId: BUNDLED_TOXICITY_MODEL_ID,
        hubFallback: HUB_KCELECTRA_TOXICITY,
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
export function resolveSentimentBundledId() {
    return resolveBundledSentimentModelId();
}
export function resolveEmbeddingModelId(preset) {
    const env = process.env.KCA_SEMANTIC_MODEL?.trim();
    if (env)
        return env;
    if (isBundledEmbedModelReady())
        return BUNDLED_EMBED_MODEL_ID;
    if (preset === "quality")
        return HUB_KOELECTRA_EMBED;
    return HUB_KOELECTRA_KORSTS;
}
export function resolveToxicityModelId() {
    const env = process.env.KCA_TOXICITY_MODEL?.trim();
    if (env)
        return env;
    if (process.env.KCA_TOXICITY_HUB_ONLY === "1")
        return HUB_KCELECTRA_TOXICITY;
    return BUNDLED_TOXICITY_MODEL_ID;
}
//# sourceMappingURL=registry.js.map