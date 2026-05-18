import { type LlmRunPlan } from "./llm-policy.js";
import { type Qwen35Size } from "./llm-qwen35.js";
import type { AnalysisPresetName } from "./analysis-preset.js";
import type { BuildReportOptions } from "./analyze-pool.js";
import type { LlmInsights, ReportData, ReportTopic } from "./types.js";
import type { RoomNarrative } from "./room-narrative.js";
export type LlmSkipReasonCode = "disabled" | "gguf_missing" | "timeout" | "json_parse" | "inference_error";
export interface LlmEnrichmentResult {
    used: boolean;
    plan: LlmRunPlan;
    narrative?: RoomNarrative;
    topics?: ReportTopic[];
    llmInsights?: LlmInsights;
    skipReason?: string;
}
interface LlmCompletionOk {
    ok: true;
    raw: string;
    size: Qwen35Size;
    elapsedMs: number;
}
interface LlmCompletionFail {
    ok: false;
    skipReason: string;
    code: LlmSkipReasonCode;
    size: Qwen35Size;
    elapsedMs: number;
}
type LlmCompletionResult = LlmCompletionOk | LlmCompletionFail;
export declare function runLlmCompletion(data: ReportData, plan: LlmRunPlan, opts?: {
    compact?: boolean;
    sizeOverride?: Qwen35Size;
}): Promise<LlmCompletionResult>;
/** preset·RAM 기준 Qwen3.5 자동 선택 후 서사·주제 보강 */
export declare function applyLlmEnrichment(data: ReportData, options?: BuildReportOptions, messageCount?: number): Promise<LlmEnrichmentResult>;
/** @deprecated use applyLlmEnrichment */
export declare function summarizeTopicsWithLlm(preset: AnalysisPresetName, topics: string[], sampleLines: string[]): Promise<null>;
export {};
