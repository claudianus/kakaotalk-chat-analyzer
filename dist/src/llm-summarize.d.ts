import { type LlmTier } from "./llm-policy.js";
import type { AnalysisPresetName } from "./analysis-preset.js";
import type { BuildReportOptions } from "./analyze-pool.js";
import type { LlmInsights, ReportData, ReportTopic } from "./types.js";
import type { RoomNarrative } from "./room-narrative.js";
export interface LlmEnrichmentResult {
    used: boolean;
    tier: LlmTier;
    narrative?: RoomNarrative;
    topics?: ReportTopic[];
    llmInsights?: LlmInsights;
}
export declare function runLlmCompletion(data: ReportData, tier: Exclude<LlmTier, "off">): Promise<string | null>;
/** quality 등 preset에서 LLM 서사·주제 보강 */
export declare function applyLlmEnrichment(data: ReportData, options?: BuildReportOptions, messageCount?: number): Promise<LlmEnrichmentResult>;
/** @deprecated use applyLlmEnrichment */
export declare function summarizeTopicsWithLlm(preset: AnalysisPresetName, topics: string[], sampleLines: string[]): Promise<null>;
