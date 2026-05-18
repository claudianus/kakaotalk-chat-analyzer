import { type MachineProfile } from "./analysis-capability.js";
/** GGUF 로드 시점 — macOS 등에서 available ≫ free 이면 free 기준으로 다운그레이드 */
export declare function memoryHeadroomForLlmLoad(profile: MachineProfile): number;
import type { AnalysisPresetName } from "./analysis-preset.js";
import { type Qwen35Size } from "./llm-qwen35.js";
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
}
/** RAM 에 맞는 최대 Qwen3.5 (9B→4B→2B→0.8B) */
export declare function pickLargestQwen35ForRam(headroomGb: number): Qwen35Size | undefined;
export declare function resolveLlmRunPlan(input: ResolveLlmRunPlanInput): LlmRunPlan;
export declare function isLlmAutoEnabled(): boolean;
/** 분석 예산용 LLM 단계 예약(ms) */
export declare function llmPhaseReserveMs(size: Qwen35Size | undefined, preset: AnalysisPresetName): number;
