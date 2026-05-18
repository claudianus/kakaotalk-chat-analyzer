import { memoryHeadroomGb } from "./analysis-capability.js";
import { QWEN35_CATALOG, qwen35DisplayLabel, qwen35Entry, parseQwen35Size, } from "./llm-qwen35.js";
const DEFAULT_LLM_RAM_RESERVE_GB = 7;
const DEFAULT_LLM_TIMEOUT_MS = 45_000;
const MIN_LLM_LOAD_HEADROOM_GB = 3;
const MAX_RECLAIM_GB = 8;
const RECLAIM_FRACTION = 0.35;
/** OS·ONNX·집계 버퍼 — `KCA_LLM_RAM_RESERVE_GB`로 조정 */
export function llmRamReserveGb(profile) {
    const env = Number(process.env.KCA_LLM_RAM_RESERVE_GB);
    if (Number.isFinite(env) && env >= 3)
        return env;
    const total = profile.totalMemGb;
    if (total >= 48)
        return 8;
    if (total >= 32)
        return 7;
    if (total >= 16)
        return 6;
    return DEFAULT_LLM_RAM_RESERVE_GB;
}
/**
 * GGUF 로드 시점 가용 RAM — available−예약 우선, free+회수 가능분으로 OOM만 완화.
 */
export function memoryHeadroomForLlmLoad(profile) {
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
/** RAM 에 맞는 최대 Qwen3.5 (9B→4B→2B→0.8B) */
export function pickLargestQwen35ForRam(headroomGb) {
    for (const entry of QWEN35_CATALOG) {
        if (headroomGb >= entry.minHeadroomGb)
            return entry.size;
    }
    return undefined;
}
function formatRamNote(profile, loadHeadroom, available) {
    const reserve = llmRamReserveGb(profile);
    if (loadHeadroom < available - reserve + 0.5) {
        return `RAM 로드 ${loadHeadroom}GB (가용 ${available}GB−예약 ${reserve}GB·free ${profile.freeMemGb}GB)`;
    }
    return `RAM ${loadHeadroom}GB (가용 ${available}GB−예약 ${reserve}GB)`;
}
export function resolveLlmRunPlan(input) {
    const { preset, profile } = input;
    const available = memoryHeadroomGb(profile);
    const loadHeadroom = memoryHeadroomForLlmLoad(profile);
    const ramNote = formatRamNote(profile, loadHeadroom, available);
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
export function isLlmAutoEnabled() {
    return process.env.KCA_LLM !== "0";
}
/** GGUF 첫 로드 상한(ms) */
export function llmLoadTimeoutMs(size) {
    const entry = qwen35Entry(size);
    return Math.max(90_000, entry.timeoutMs);
}
function envLlmTimeoutMs() {
    const env = Number(process.env.KCA_LLM_TIMEOUT_MS);
    return Number.isFinite(env) && env > 0 ? env : DEFAULT_LLM_TIMEOUT_MS;
}
/** 추론 단계 상한(ms) */
export function llmInferTimeoutMs(size, plan) {
    if (plan?.timeoutMs && plan.timeoutMs > 0)
        return plan.timeoutMs;
    const env = envLlmTimeoutMs();
    if (env !== DEFAULT_LLM_TIMEOUT_MS)
        return env;
    return qwen35Entry(size).timeoutMs;
}
/** 분석 예산용 LLM 단계 예약(ms) — 로드+추론 */
export function llmPhaseReserveMs(size, preset) {
    if (!size)
        return 50_000;
    const load = llmLoadTimeoutMs(size);
    const infer = llmInferTimeoutMs(size);
    let reserve = load + infer + 5_000;
    if (size === "9B" && preset === "quality") {
        reserve = Math.max(reserve, 150_000);
    }
    else if (size === "9B") {
        reserve = Math.max(reserve, 130_000);
    }
    else if (size === "4B") {
        reserve = Math.max(reserve, 100_000);
    }
    return reserve;
}
//# sourceMappingURL=llm-resolve.js.map