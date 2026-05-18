import { type LlmRunPlan } from "./llm-policy.js";
import type { AnalysisPresetName } from "./analysis-preset.js";
import type { BuildReportOptions } from "./analyze-pool.js";
import type { LlmInsights, ReportData, ReportTopic } from "./types.js";
import type { RoomNarrative } from "./room-narrative.js";
export interface LlmEnrichmentResult {
    used: boolean;
    plan: LlmRunPlan;
    narrative?: RoomNarrative;
    topics?: ReportTopic[];
    llmInsights?: LlmInsights;
}
export declare function runLlmCompletion(data: ReportData, plan: LlmRunPlan): Promise<string | null>;
/** preset·RAM 기준 Qwen3.5 자동 선택 후 서사·주제 보강 */
export declare function applyLlmEnrichment(data: ReportData, options?: BuildReportOptions, messageCount?: number): Promise<LlmEnrichmentResult>;
/** @deprecated use applyLlmEnrichment */
export declare function summarizeTopicsWithLlm(preset: AnalysisPresetName, topics: string[], sampleLines: string[]): Promise<null>;
