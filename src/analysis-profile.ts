import type { BuildReportOptions } from "./analyze-pool.js";
import { getPresetEffectiveFlags } from "./analysis-preset.js";

export type AnalysisProfile = "quality" | "fast";

export interface AnalysisProfileSettings {
  profile: AnalysisProfile;
  useEmbeddingTopics: boolean;
  semanticSupplementRrfWeight: number;
  semanticClusterMinCoherence: number;
}

export function resolveAnalysisProfile(options?: BuildReportOptions): AnalysisProfile {
  const preset = getPresetEffectiveFlags(options);
  if (preset.profile === "fast") return "fast";
  if (options?.worker === true || process.env.KCA_PROFILE === "fast") return "fast";
  return "quality";
}

export function getAnalysisProfileSettings(options?: BuildReportOptions): AnalysisProfileSettings {
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
