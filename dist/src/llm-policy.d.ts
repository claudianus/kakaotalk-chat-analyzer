import { type MachineProfile } from "./analysis-capability.js";
import type { AnalysisPresetName } from "./analysis-preset.js";
/** Qwen3.5 Instruct GGUF — 텍스트 요약·주제 보강용 */
export declare const QWEN35_MODELS: {
    readonly "0.8b": "Qwen/Qwen3.5-0.8B-Instruct-GGUF";
    readonly "2b": "Qwen/Qwen3.5-2B-Instruct-GGUF";
    readonly "4b": "Qwen/Qwen3.5-4B-Instruct-GGUF";
    readonly "8b": "Qwen/Qwen3-8B-GGUF";
};
export type LlmTier = "off" | "0.8b" | "2b" | "4b" | "8b";
export declare function resolveLlmTier(preset: AnalysisPresetName, profile: MachineProfile): LlmTier;
export declare function llmTimeoutMs(): number;
export declare function qwenModelIdForTier(tier: LlmTier): string | undefined;
