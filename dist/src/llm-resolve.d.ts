import { type MachineProfile } from "./analysis-capability.js";
import type { AnalysisPresetName } from "./analysis-preset.js";
import { type Qwen35Size } from "./llm-qwen35.js";
/** OS·ONNX·집계 버퍼 — `KCA_LLM_RAM_RESERVE_GB`로 조정 */
export declare function llmRamReserveGb(profile: MachineProfile): number;
/**
 * GGUF 로드 시점 가용 RAM — available−예약 우선, free+회수 가능분으로 OOM만 완화.
 */
export declare function memoryHeadroomForLlmLoad(profile: MachineProfile): number;
/** ML dispose 직후 GGUF 로드용 headroom — free RAM을 더 보수적으로 반영 */
export declare function effectiveLlmHeadroomGb(profile: MachineProfile): number;
export interface LlmRunPlan {
    enabled: boolean;
    size?: Qwen35Size;
    hubId?: string;
    ollamaModel?: string;
    timeoutMs?: number;
    /** provenance·stderr */
    reason: string;
}
export interface ResolveLlmRunPlanInput {
    preset: AnalysisPresetName;
    profile: MachineProfile;
    messageCount?: number;
    /** true = ONNX dispose 직후 — free RAM 기준 보수적 headroom */
    postMl?: boolean;
}
/** RAM 에 맞는 최대 Qwen3.5 (9B→4B→2B→0.8B) */
export declare function pickLargestQwen35ForRam(headroomGb: number): Qwen35Size | undefined;
export declare function resolveLlmRunPlan(input: ResolveLlmRunPlanInput): LlmRunPlan;
export declare function isLlmAutoEnabled(): boolean;
/** LLM 재시도·reprompt 전 free RAM 하한 — `KCA_LLM_MIN_FREE_GB` */
export declare function minFreeGbForLlmRetry(): number;
/** GGUF 재로드/reprompt 허용 여부 (dispose 후 reprobe 기준) */
export declare function canRetryLlmRam(profile: MachineProfile, retrySize?: Qwen35Size): boolean;
/** GGUF 첫 로드 상한(ms) */
export declare function llmLoadTimeoutMs(size: Qwen35Size): number;
/** 추론 단계 상한(ms) */
export declare function llmInferTimeoutMs(size: Qwen35Size, plan?: LlmRunPlan): number;
/**
 * 분석 예산용 LLM 단계 예약(ms) — 로드+추론.
 * 실제 타임아웃(`llmLoadTimeoutMs`)보다 짧게 잡아, 빠른 파이프라인 뒤에도 LLM 여유를 남긴다.
 */
export declare function llmPhaseReserveMs(size: Qwen35Size | undefined, preset: AnalysisPresetName): number;
