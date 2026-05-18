import { type MachineProfile } from "./analysis-capability.js";
import { type AnalysisPresetName } from "./analysis-preset.js";
import { type LlmTier } from "./llm-policy.js";
import type { BuildReportProvenanceOptions } from "./report-provenance.js";
import type { PrivacyMode, ReportData } from "./types.js";
export type PresetSource = "cli" | "env" | "auto-ram" | "auto-corpus" | "legacy-fast";
export interface PhaseEffectiveState {
    requested: boolean | "auto";
    used: boolean;
    model?: string;
    sampleCap?: number;
    skippedReason?: string;
}
export interface AnalysisEffectiveConfig {
    preset: AnalysisPresetName;
    presetSource: PresetSource;
    profile: "quality" | "fast";
    privacy: PrivacyMode;
    top: number;
    since?: string;
    workerRequested: boolean | "auto";
    workerUsed: boolean;
    semantic: PhaseEffectiveState;
    sentiment: PhaseEffectiveState;
    encoderPlane: {
        sentiment: string;
        embedding: string;
        toxicity: string;
    };
    llm: {
        tier: LlmTier;
        used: boolean;
        modelId?: string;
        skippedReason?: string;
    };
    topicModel: "graph" | "embedding" | "hybrid";
    embeddingTopics: boolean;
    budgetMs: number;
    envOverrides: string[];
    invokedVia?: {
        name: "kcachat";
        version: string;
    };
    messageCount: number;
    machine: Pick<MachineProfile, "freeMemGb" | "availableMemGb" | "totalMemGb" | "gpu">;
}
export interface CliPipelineOptions {
    privacy: PrivacyMode;
    top: number;
    since?: string;
    preset?: AnalysisPresetName;
    worker?: boolean;
    semanticKeywords?: boolean;
    sentiment?: boolean;
}
export declare function resolvePresetSource(cliPreset: AnalysisPresetName | undefined, worker: boolean | undefined, messageCount: number, machine: MachineProfile): PresetSource;
/** 집계 완료 후 실제 적용 설정 */
export declare function buildAnalysisEffectiveConfig(data: ReportData, cli: CliPipelineOptions, machine?: MachineProfile): AnalysisEffectiveConfig;
export declare function withWorkerUsed(config: AnalysisEffectiveConfig, workerUsed: boolean): AnalysisEffectiveConfig;
/** 집계 전 예상 preset (stderr 힌트) */
export declare function estimatePresetBeforeParse(cli: Pick<CliPipelineOptions, "preset" | "worker">, messageEstimate?: number): {
    preset: AnalysisPresetName;
    source: PresetSource;
};
export declare function formatEstimatedPresetHint(cli: Pick<CliPipelineOptions, "preset" | "worker">, messageEstimate?: number): string;
export declare function formatConfigSummaryKo(config: AnalysisEffectiveConfig): string;
export declare function configToJson(config: AnalysisEffectiveConfig): string;
export declare function toProvenanceOptions(config: AnalysisEffectiveConfig, data: ReportData, extras: {
    kiwiAvailable: boolean;
    buildTiming?: BuildReportProvenanceOptions["buildTiming"];
    htmlBytes?: number;
}): BuildReportProvenanceOptions;
