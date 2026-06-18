import type { ReportData } from "./types.js";
import type { LlmSchemaTier } from "./llm-schema.js";
import type { Qwen35Size } from "./llm-qwen35.js";
export interface BuildLlmPromptOptions {
    compact?: boolean;
    /** harness repair attempt — 이전 실패 피드백 */
    repairFeedback?: string;
    schemaTier?: LlmSchemaTier;
}
/** LLM 입력 — 원문 메시지·PII 없이 통계·키워드·주제만 */
export declare function buildLlmPromptPayload(data: ReportData, opts?: BuildLlmPromptOptions): string;
/** 티어·모델 크기별 system prompt — STROT식 작업 분해 + 규칙 recency */
export declare function buildLlmSystemPrompt(opts?: {
    tier?: LlmSchemaTier;
    size?: Qwen35Size;
}): string;
/** @deprecated buildLlmSystemPrompt({ tier: "full" }) 사용 */
export declare const LLM_SYSTEM_PROMPT: string;
/** 도메인 매칭 micro few-shot — SLM에서 정적 예시보다 효과적 */
export declare function buildLlmKeywordMicroExample(data: ReportData): string;
/** fill-in-the-blank JSON skeleton — constrained decoding 보조 */
export declare function buildLlmOutputSkeleton(data: ReportData, tier: LlmSchemaTier): string;
/** 통계 payload + skeleton + micro few-shot 조립 */
export declare function assembleLlmUserPrompt(data: ReportData, opts?: BuildLlmPromptOptions): string;
