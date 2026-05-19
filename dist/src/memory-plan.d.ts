import type { MachineProfile } from "./analysis-capability.js";
import { effectiveLlmHeadroomGb } from "./llm-resolve.js";
import type { Qwen35Size } from "./llm-qwen35.js";
export interface MemoryTimelineEntry {
    phase: string;
    availableGb: number;
    freeGb: number;
    totalGb: number;
    note?: string;
    chosenLlmSize?: Qwen35Size;
}
export declare function resetMemoryTimeline(): void;
export declare function pushMemoryTimeline(phase: string, profile: MachineProfile, extra?: {
    note?: string;
    chosenLlmSize?: Qwen35Size;
}): void;
export declare function getMemoryTimeline(): readonly MemoryTimelineEntry[];
export { effectiveLlmHeadroomGb };
/** post-ML headroom으로 선택 가능한 최대 Qwen3.5 */
export declare function pickLargestQwen35AfterMl(profile: MachineProfile): Qwen35Size | undefined;
