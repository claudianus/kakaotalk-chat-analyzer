import { type LlmRunPlan } from "./llm-policy.js";
import { type Qwen35Size } from "./llm-qwen35.js";
import type { AnalysisPresetName } from "./analysis-preset.js";
import type { BuildReportOptions } from "./analyze-pool.js";
import type { AnalysisBudgetTracker } from "./analysis-budget.js";
import { type LlmJsonShape } from "./llm-json.js";
import type { LlmHarnessQuality, LlmInsights, ReportData, ReportTopic } from "./types.js";
import type { RoomNarrative } from "./room-narrative.js";
import { type LlamaGpuMode } from "./llm-llama-core.js";
export type LlmSkipReasonCode = "disabled" | "gguf_missing" | "timeout" | "json_parse" | "inference_error";
export interface LlmEnrichmentResult {
    used: boolean;
    plan: LlmRunPlan;
    narrative?: RoomNarrative;
    topics?: ReportTopic[];
    llmInsights?: LlmInsights;
    llmQuality?: LlmHarnessQuality;
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
export interface LlmCompletionOpts {
    compact?: boolean;
    sizeOverride?: Qwen35Size;
    gpuOverride?: LlamaGpuMode;
    temperature?: number;
    /** 하네스가 attempt ladder를 담당 — 내부 GPU/downgrade ladder 생략 */
    harnessSingleShot?: boolean;
    /** 이전 attempt 실패 피드백 — repair 프롬프트에 포함 */
    repairFeedback?: string;
}
export declare function runLlmCompletion(data: ReportData, plan: LlmRunPlan, opts?: LlmCompletionOpts): Promise<LlmCompletionResult>;
export declare function buildEnrichmentFromParsed(data: ReportData, parsed: LlmJsonShape, plan: LlmRunPlan, repairAttempts?: number): LlmEnrichmentResult;
export declare function parseCompletionRaw(raw: string): LlmJsonShape | null;
export declare function schemaFailureQuality(repairAttempts?: number): LlmHarnessQuality;
export declare function llmRetryBudgetSkipReason(budget?: AnalysisBudgetTracker): string | undefined;
export interface LlmEnrichmentRunContext {
    budget?: AnalysisBudgetTracker;
    llmPlan?: LlmRunPlan;
}
/** preset·RAM 기준 Qwen3.5 자동 선택 후 서사·주제 보강 */
export declare function applyLlmEnrichment(data: ReportData, options?: BuildReportOptions, messageCount?: number, ctx?: LlmEnrichmentRunContext): Promise<LlmEnrichmentResult>;
/** @deprecated use applyLlmEnrichment */
export declare function summarizeTopicsWithLlm(preset: AnalysisPresetName, topics: string[], sampleLines: string[]): Promise<null>;
export {};
