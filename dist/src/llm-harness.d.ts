import type { AnalysisBudgetTracker } from "./analysis-budget.js";
import type { LlmRunPlan } from "./llm-policy.js";
import { type Qwen35Size } from "./llm-qwen35.js";
import type { LlamaGpuMode } from "./llm-llama-core.js";
import type { ReportData } from "./types.js";
import { type LlmEnrichmentResult } from "./llm-summarize.js";
export interface LlmHarnessAttemptSpec {
    label: string;
    compact: boolean;
    size: Qwen35Size;
    gpu?: LlamaGpuMode;
}
export declare function buildHarnessAttemptLadder(plan: LlmRunPlan): LlmHarnessAttemptSpec[];
/** 하네스 성공 — LLM 검증 통과 또는 규칙 fallback deck */
export declare function hasHarnessDeckContent(result: LlmEnrichmentResult): boolean;
export declare function isHarnessSuccess(result: LlmEnrichmentResult): boolean;
/** 통합 LLM 하네스 — 추론·파싱·검증·재시도를 단일 루프로 처리 */
export declare function runLlmHarness(data: ReportData, plan: LlmRunPlan, budget?: AnalysisBudgetTracker): Promise<LlmEnrichmentResult>;
