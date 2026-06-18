import type { LlmRunPlan } from "./llm-policy.js";
import type { LlmEnrichmentResult } from "./llm-summarize.js";
import type { ReportData } from "./types.js";
/** LLM 추론·검증 전부 실패 시 규칙 기반 deck — 리포트에 최소한의 스토리 레이어를 남김 */
export declare function buildRuleBasedLlmFallback(data: ReportData, plan: LlmRunPlan, args?: {
    repairAttempts?: number;
    reason?: string;
}): LlmEnrichmentResult;
