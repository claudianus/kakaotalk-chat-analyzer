import type { MachineProfile } from "./analysis-capability.js";
import {
  effectiveLlmHeadroomGb,
  pickLargestQwen35ForRam,
} from "./llm-resolve.js";
import type { Qwen35Size } from "./llm-qwen35.js";

export interface MemoryTimelineEntry {
  phase: string;
  availableGb: number;
  freeGb: number;
  totalGb: number;
  note?: string;
  chosenLlmSize?: Qwen35Size;
}

const timeline: MemoryTimelineEntry[] = [];

export function resetMemoryTimeline(): void {
  timeline.length = 0;
}

export function pushMemoryTimeline(
  phase: string,
  profile: MachineProfile,
  extra?: { note?: string; chosenLlmSize?: Qwen35Size },
): void {
  timeline.push({
    phase,
    availableGb: Math.round(profile.availableMemGb * 10) / 10,
    freeGb: Math.round(profile.freeMemGb * 10) / 10,
    totalGb: Math.round(profile.totalMemGb * 10) / 10,
    ...extra,
  });
}

export function getMemoryTimeline(): readonly MemoryTimelineEntry[] {
  return timeline;
}

export { effectiveLlmHeadroomGb };

/** post-ML headroom으로 선택 가능한 최대 Qwen3.5 */
export function pickLargestQwen35AfterMl(profile: MachineProfile): Qwen35Size | undefined {
  return pickLargestQwen35ForRam(effectiveLlmHeadroomGb(profile));
}
