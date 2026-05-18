import { memoryHeadroomGb, type MachineProfile } from "./analysis-capability.js";

const LLM_LOAD_RAM_GAP_GB = 4;

/** GGUF 로드 시점 — macOS 등에서 available ≫ free 이면 free 기준으로 다운그레이드 */
export function memoryHeadroomForLlmLoad(profile: MachineProfile): number {
  const available = memoryHeadroomGb(profile);
  const free = profile.freeMemGb;
  if (available - free > LLM_LOAD_RAM_GAP_GB) {
    return Math.min(available, Math.max(free, 3));
  }
  return available;
}
import type { AnalysisPresetName } from "./analysis-preset.js";
import {
  QWEN35_CATALOG,
  qwen35DisplayLabel,
  qwen35Entry,
  parseQwen35Size,
  type Qwen35Size,
} from "./llm-qwen35.js";

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
export function pickLargestQwen35ForRam(headroomGb: number): Qwen35Size | undefined {
  for (const entry of QWEN35_CATALOG) {
    if (headroomGb >= entry.minHeadroomGb) return entry.size;
  }
  return undefined;
}

export function resolveLlmRunPlan(input: ResolveLlmRunPlanInput): LlmRunPlan {
  const { preset, profile } = input;
  const available = memoryHeadroomGb(profile);
  const loadHeadroom = memoryHeadroomForLlmLoad(profile);
  const ramNote =
    loadHeadroom < available - 0.5
      ? `RAM 로드 ${loadHeadroom}GB (가용 ${available}GB·free ${profile.freeMemGb}GB)`
      : `RAM ${loadHeadroom}GB`;

  if (process.env.KCA_LLM === "0") {
    return { enabled: false, reason: "KCA_LLM=0" };
  }

  if (process.env.KCA_LLM_MOCK === "1") {
    const size = "0.8B";
    const e = qwen35Entry(size);
    return {
      enabled: true,
      size,
      hubId: e.gguf.hubId,
      ollamaModel: e.ollamaTag,
      timeoutMs: e.timeoutMs,
      reason: `mock (${qwen35DisplayLabel(size)})`,
    };
  }

  const forced = process.env.KCA_LLM_MODEL?.trim();
  if (forced) {
    const size = parseQwen35Size(forced);
    if (!size) {
      return {
        enabled: false,
        reason: `KCA_LLM_MODEL=${forced} (지원: 0.8B|2B|4B|9B)`,
      };
    }
    const e = qwen35Entry(size);
    if (loadHeadroom < e.minHeadroomGb) {
      return {
        enabled: false,
        reason: `${qwen35DisplayLabel(size)} 필요 RAM≥${e.minHeadroomGb}GB (${ramNote})`,
      };
    }
    return {
      enabled: true,
      size,
      hubId: e.gguf.hubId,
      ollamaModel: e.ollamaTag,
      timeoutMs: e.timeoutMs,
      reason: `env KCA_LLM_MODEL (${qwen35DisplayLabel(size)}, ${ramNote})`,
    };
  }

  const size = pickLargestQwen35ForRam(loadHeadroom);
  if (!size) {
    return {
      enabled: false,
      reason: `Qwen3.5 최소 RAM 3GB 미만 (${ramNote})`,
    };
  }

  const e = qwen35Entry(size);
  return {
    enabled: true,
    size,
    hubId: e.gguf.hubId,
    ollamaModel: e.ollamaTag,
    timeoutMs: e.timeoutMs,
    reason: `자동 최대 ${qwen35DisplayLabel(size)} (${preset}, ${ramNote})`,
  };
}

export function isLlmAutoEnabled(): boolean {
  return process.env.KCA_LLM !== "0";
}

/** 분석 예산용 LLM 단계 예약(ms) */
export function llmPhaseReserveMs(size: Qwen35Size | undefined, preset: AnalysisPresetName): number {
  if (!size) return 50_000;
  const entry = qwen35Entry(size);
  if (size === "9B" && preset === "quality") return Math.max(entry.timeoutMs - 15_000, 55_000);
  if (size === "9B") return 75_000;
  if (size === "4B") return 55_000;
  return 45_000;
}
