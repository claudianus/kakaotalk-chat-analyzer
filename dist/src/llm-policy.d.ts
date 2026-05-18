import type { MachineProfile } from "./analysis-capability.js";
import type { AnalysisPresetName } from "./analysis-preset.js";
import { type Qwen35Size } from "./llm-qwen35.js";
import { type LlmRunPlan } from "./llm-resolve.js";
export type { Qwen35Size } from "./llm-qwen35.js";
export type { LlmRunPlan } from "./llm-resolve.js";
export { resolveLlmRunPlan, pickLargestQwen35ForRam, isLlmAutoEnabled, llmPhaseReserveMs, llmLoadTimeoutMs, llmInferTimeoutMs, memoryHeadroomForLlmLoad, llmRamReserveGb, } from "./llm-resolve.js";
export { parseQwen35Size } from "./llm-qwen35.js";
/** @deprecated LlmRunPlan 사용 */
export type LlmTier = "off" | Qwen35Size;
export declare function resolveLlmRunPlanForPreset(preset: AnalysisPresetName, profile: MachineProfile, messageCount?: number): LlmRunPlan;
/** @deprecated resolveLlmRunPlan().enabled / .size 사용 */
export declare function resolveLlmTier(preset: AnalysisPresetName, profile: MachineProfile): LlmTier;
/** @deprecated parseQwen35Size 사용 */
export declare function parseLlmTierName(raw: string): LlmTier | undefined;
export declare function llmTimeoutMs(): number;
export declare function qwenModelIdForPlan(plan: LlmRunPlan): string | undefined;
/** @deprecated */
export declare function qwenModelIdForTier(tier: LlmTier): string | undefined;
