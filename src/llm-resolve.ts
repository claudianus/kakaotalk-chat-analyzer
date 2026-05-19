import { memoryHeadroomGb, type MachineProfile } from "./analysis-capability.js";
import type { AnalysisPresetName } from "./analysis-preset.js";
import {
  QWEN35_CATALOG,
  qwen35DisplayLabel,
  qwen35Entry,
  parseQwen35Size,
  type Qwen35Size,
} from "./llm-qwen35.js";
const DEFAULT_LLM_RAM_RESERVE_GB = 7;
const DEFAULT_LLM_TIMEOUT_MS = 45_000;
const MAX_RECLAIM_GB = 8;
const RECLAIM_FRACTION = 0.35;
const DEFAULT_MIN_FREE_GB_FOR_LLM_RETRY = 1.5;

/** OS·ONNX·집계 버퍼 — `KCA_LLM_RAM_RESERVE_GB`로 조정 */
export function llmRamReserveGb(profile: MachineProfile): number {
  const env = Number(process.env.KCA_LLM_RAM_RESERVE_GB);
  if (Number.isFinite(env) && env >= 3) return env;
  const total = profile.totalMemGb;
  if (total >= 48) return 8;
  if (total >= 32) return 7;
  if (total >= 16) return 6;
  return DEFAULT_LLM_RAM_RESERVE_GB;
}

/**
 * GGUF 로드 시점 가용 RAM — available−예약 우선, free+회수 가능분으로 OOM만 완화.
 */
export function memoryHeadroomForLlmLoad(profile: MachineProfile): number {
  const available = memoryHeadroomGb(profile);
  const free = profile.freeMemGb;
  const reserve = llmRamReserveGb(profile);
  let headroom = available - reserve;

  const reclaimable = Math.max(0, available - free);
  const reclaimGb = Math.min(MAX_RECLAIM_GB, reclaimable * RECLAIM_FRACTION);
  const freeCeiling = free + reclaimGb;
  if (freeCeiling < headroom) {
    headroom = freeCeiling;
  }

  return Math.round(headroom * 10) / 10;
}

const POST_ML_OS_SLACK_GB = 2;

/** ML dispose 직후 GGUF 로드용 headroom — free RAM을 더 보수적으로 반영 */
export function effectiveLlmHeadroomGb(profile: MachineProfile): number {
  const loadHeadroom = memoryHeadroomForLlmLoad(profile);
  const free = profile.freeMemGb;
  const minFree = minFreeGbForLlmRetry();

  let effective = loadHeadroom;
  const freeCap = Math.max(0, free - POST_ML_OS_SLACK_GB);
  if (freeCap < effective) effective = freeCap;

  if (free < minFree) {
    effective = Math.min(effective, qwen35Entry("0.8B").minHeadroomGb);
  } else if (free < 4) {
    effective = Math.min(effective, qwen35Entry("2B").minHeadroomGb);
  } else if (free < 6) {
    effective = Math.min(effective, qwen35Entry("4B").minHeadroomGb - 0.1);
  }

  return Math.round(Math.max(0, effective) * 10) / 10;
}

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
export function pickLargestQwen35ForRam(headroomGb: number): Qwen35Size | undefined {
  for (const entry of QWEN35_CATALOG) {
    if (headroomGb >= entry.minHeadroomGb) return entry.size;
  }
  return undefined;
}

function formatRamNote(
  profile: MachineProfile,
  loadHeadroom: number,
  available: number,
  phase?: string,
): string {
  const reserve = llmRamReserveGb(profile);
  const phaseTag = phase ? `, ${phase}` : "";
  if (loadHeadroom < available - reserve + 0.5) {
    return `RAM 로드 ${loadHeadroom}GB (가용 ${available}GB−예약 ${reserve}GB·free ${profile.freeMemGb}GB${phaseTag})`;
  }
  return `RAM ${loadHeadroom}GB (가용 ${available}GB−예약 ${reserve}GB${phaseTag})`;
}

export function resolveLlmRunPlan(input: ResolveLlmRunPlanInput): LlmRunPlan {
  const { preset, profile, postMl } = input;
  const available = memoryHeadroomGb(profile);
  const loadHeadroom = postMl ? effectiveLlmHeadroomGb(profile) : memoryHeadroomForLlmLoad(profile);
  const ramNote = formatRamNote(
    profile,
    loadHeadroom,
    available,
    postMl ? "post-ML" : undefined,
  );

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

/** LLM 재시도·reprompt 전 free RAM 하한 — `KCA_LLM_MIN_FREE_GB` */
export function minFreeGbForLlmRetry(): number {
  const env = Number(process.env.KCA_LLM_MIN_FREE_GB);
  return Number.isFinite(env) && env >= 0 ? env : DEFAULT_MIN_FREE_GB_FOR_LLM_RETRY;
}

/** GGUF 재로드/reprompt 허용 여부 (dispose 후 reprobe 기준) */
export function canRetryLlmRam(profile: MachineProfile, retrySize: Qwen35Size = "0.8B"): boolean {
  const headroom = memoryHeadroomForLlmLoad(profile);
  if (headroom < qwen35Entry(retrySize).minHeadroomGb) return false;
  if (profile.freeMemGb < minFreeGbForLlmRetry()) return false;
  return true;
}

/** GGUF 첫 로드 상한(ms) */
export function llmLoadTimeoutMs(size: Qwen35Size): number {
  const entry = qwen35Entry(size);
  return Math.max(90_000, entry.timeoutMs);
}

function envLlmTimeoutMs(): number {
  const env = Number(process.env.KCA_LLM_TIMEOUT_MS);
  return Number.isFinite(env) && env > 0 ? env : DEFAULT_LLM_TIMEOUT_MS;
}

/** 추론 단계 상한(ms) */
export function llmInferTimeoutMs(size: Qwen35Size, plan?: LlmRunPlan): number {
  if (plan?.timeoutMs && plan.timeoutMs > 0) return plan.timeoutMs;
  const env = envLlmTimeoutMs();
  if (env !== DEFAULT_LLM_TIMEOUT_MS) return env;
  return qwen35Entry(size).timeoutMs;
}

/**
 * 분석 예산용 LLM 단계 예약(ms) — 로드+추론.
 * 실제 타임아웃(`llmLoadTimeoutMs`)보다 짧게 잡아, 빠른 파이프라인 뒤에도 LLM 여유를 남긴다.
 */
export function llmPhaseReserveMs(size: Qwen35Size | undefined, preset: AnalysisPresetName): number {
  if (!size) return 50_000;
  const entry = qwen35Entry(size);
  const loadPlan = entry.timeoutMs;
  const inferPlan = llmInferTimeoutMs(size);
  let reserve = loadPlan + inferPlan + 5_000;
  if (size === "9B" && preset === "quality") {
    reserve = Math.max(reserve, 120_000);
  } else if (size === "9B") {
    reserve = Math.max(reserve, 100_000);
  } else if (size === "4B") {
    reserve = Math.max(reserve, 75_000);
  }
  return reserve;
}
