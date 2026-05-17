import type { BuildReportOptions } from "./analyze-pool.js";
export type AnalysisProfile = "quality" | "fast";
export interface AnalysisProfileSettings {
    profile: AnalysisProfile;
    useEmbeddingTopics: boolean;
    semanticSupplementRrfWeight: number;
    semanticClusterMinCoherence: number;
}
export declare function resolveAnalysisProfile(options?: BuildReportOptions, messageCount?: number): AnalysisProfile;
export declare function getAnalysisProfileSettings(options?: BuildReportOptions, messageCount?: number): AnalysisProfileSettings;
