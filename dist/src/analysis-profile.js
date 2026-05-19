import { getPresetEffectiveFlags } from "./analysis-preset.js";
export function resolveAnalysisProfile(options, messageCount) {
    const preset = getPresetEffectiveFlags(options, messageCount);
    if (preset.profile === "fast")
        return "fast";
    if (options?.worker === true || process.env.KCA_PROFILE === "fast")
        return "fast";
    return "quality";
}
export function getAnalysisProfileSettings(options, messageCount) {
    const preset = getPresetEffectiveFlags(options, messageCount).preset;
    if (preset === "ultra") {
        return {
            profile: "quality",
            useEmbeddingTopics: process.env.KCA_EMBEDDING_TOPICS !== "0",
            semanticSupplementRrfWeight: 0.62,
            semanticClusterMinCoherence: 0.36,
        };
    }
    const profile = resolveAnalysisProfile(options, messageCount);
    if (profile === "fast") {
        return {
            profile,
            useEmbeddingTopics: process.env.KCA_EMBEDDING_TOPICS === "1",
            semanticSupplementRrfWeight: 0.85,
            semanticClusterMinCoherence: 0.32,
        };
    }
    return {
        profile,
        useEmbeddingTopics: process.env.KCA_EMBEDDING_TOPICS !== "0",
        semanticSupplementRrfWeight: 0.5,
        semanticClusterMinCoherence: 0.38,
    };
}
//# sourceMappingURL=analysis-profile.js.map