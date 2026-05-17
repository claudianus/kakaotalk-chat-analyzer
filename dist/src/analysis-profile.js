import { getPresetEffectiveFlags } from "./analysis-preset.js";
export function resolveAnalysisProfile(options) {
    const preset = getPresetEffectiveFlags(options);
    if (preset.profile === "fast")
        return "fast";
    if (options?.worker === true || process.env.KCA_PROFILE === "fast")
        return "fast";
    return "quality";
}
export function getAnalysisProfileSettings(options) {
    const profile = resolveAnalysisProfile(options);
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