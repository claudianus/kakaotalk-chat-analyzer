import { memoryHeadroomGb } from "./analysis-capability.js";
import { QWEN35_CATALOG, qwen35DisplayLabel, qwen35Entry, parseQwen35Size, } from "./llm-qwen35.js";
const DEFAULT_LLM_RAM_RESERVE_GB = 7;
const DEFAULT_LLM_TIMEOUT_MS = 45_000;
const MAX_RECLAIM_GB = 8;
const RECLAIM_FRACTION = 0.35;
const DEFAULT_MIN_FREE_GB_FOR_LLM_RETRY = 1.5;
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
/** macOS 등에서 inactive memory를 포함한 실제 가용량 — 환경 변수로 덮어쓰기 가능 */
function postMlOsSlackGb(profile) {
    const env = Number(process.env.KCA_LLM_POST_ML_SLACK_GB);
    if (Number.isFinite(env) && env >= 0)
        return env;
    // macOS: freeMemGb가 inactive를 포함하지 않아 과소 추정됨.
    // availableMemGb가 충분히 크면(≥total*0.4) OS slack을 줄여 freeMemGb 함정 완화
    if (profile.platform === "darwin") {
        const available = profile.availableMemGb ?? profile.freeMemGb;
        const total = profile.totalMemGb;
        if (total >= 32 && available >= total * 0.4)
            return 0.5;
        if (total >= 16 && available >= total * 0.35)
            return 1;
        return 1.5;
    }
    return 2;
}
/** macOS에서 freeMemGb가 inactive memory를 제외해 과소 추정될 때 완화 */
function isDarwinFreeMemUnderstated(profile) {
    if (profile.platform !== "darwin")
        return false;
    const available = profile.availableMemGb ?? profile.freeMemGb;
    const free = profile.freeMemGb;
    // available이 free보다 3배 이상 크면 inactive memory가 많다는 의미
    return available > free * 3 && available >= 10;
}
/** ML dispose 직후 GGUF 로드용 headroom — macOS에서 freeMemGb 함정 완화, availableMemGb 우선 */
export function effectiveLlmHeadroomGb(profile) {
    const loadHeadroom = memoryHeadroomForLlmLoad(profile);
    const available = profile.availableMemGb ?? profile.freeMemGb;
    const free = profile.freeMemGb;
    const minFree = minFreeGbForLlmRetry();
    const slack = postMlOsSlackGb(profile);
    const isUnderstated = isDarwinFreeMemUnderstated(profile);
    let effective = loadHeadroom;
    // macOS에서 inactive memory가 많으면 freeMemGb 대신 availableMemGb 기반 제한 사용
    if (isUnderstated) {
        const availableCap = Math.max(0, available - slack);
        if (availableCap < effective)
            effective = availableCap;
    }
    else {
        const freeCap = Math.max(0, free - slack);
        if (freeCap < effective)
            effective = freeCap;
    }
    // free가 극도로 낮으면 최소 모델만 허용
    if (free < minFree && !isUnderstated) {
        effective = Math.min(effective, qwen35Entry("0.8B").minHeadroomGb);
    }
    else if (free < minFree && isUnderstated && available < 6) {
        effective = Math.min(effective, qwen35Entry("0.8B").minHeadroomGb);
    }
    else if (free < 4 && !isUnderstated) {
        effective = Math.min(effective, qwen35Entry("2B").minHeadroomGb);
    }
    else if (free < 6 && !isUnderstated) {
        effective = Math.min(effective, qwen35Entry("4B").minHeadroomGb - 0.1);
    }
    return Math.round(Math.max(0, effective) * 10) / 10;
}
/** RAM 에 맞는 최대 Qwen3.5 (9B→4B→2B→0.8B) */
export function pickLargestQwen35ForRam(headroomGb) {
    for (const entry of QWEN35_CATALOG) {
        if (headroomGb >= entry.minHeadroomGb)
            return entry.size;
    }
    return undefined;
}
const QWEN35_SIZE_ORDER = ["9B", "4B", "2B", "0.8B"];
/** preset 최소 티어 — RAM 부족 시 가능한 최대만 */
export function pickQwen35ForPreset(preset, headroomGb) {
    const largest = pickLargestQwen35ForRam(headroomGb);
    if (!largest)
        return undefined;
    const minSize = preset === "ultra" ? "4B" : preset === "quality" ? "2B" : undefined;
    if (!minSize)
        return largest;
    const largestIdx = QWEN35_SIZE_ORDER.indexOf(largest);
    const minIdx = QWEN35_SIZE_ORDER.indexOf(minSize);
    if (largestIdx <= minIdx)
        return largest;
    if (headroomGb >= qwen35Entry(minSize).minHeadroomGb)
        return minSize;
    return largest;
}
function formatRamNote(profile, loadHeadroom, available, phase) {
    const reserve = llmRamReserveGb(profile);
    const phaseTag = phase ? `, ${phase}` : "";
    if (loadHeadroom < available - reserve + 0.5) {
        return `RAM 로드 ${loadHeadroom}GB (가용 ${available}GB−예약 ${reserve}GB·free ${profile.freeMemGb}GB${phaseTag})`;
    }
    return `RAM ${loadHeadroom}GB (가용 ${available}GB−예약 ${reserve}GB${phaseTag})`;
}
export function resolveLlmRunPlan(input) {
    const { preset, profile, postMl } = input;
    const available = memoryHeadroomGb(profile);
    const loadHeadroom = postMl ? effectiveLlmHeadroomGb(profile) : memoryHeadroomForLlmLoad(profile);
    const ramNote = formatRamNote(profile, loadHeadroom, available, postMl ? "post-ML" : undefined);
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
    const size = pickQwen35ForPreset(preset, loadHeadroom);
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
/** LLM 재시도·reprompt 전 free RAM 하한 — `KCA_LLM_MIN_FREE_GB` */
export function minFreeGbForLlmRetry() {
    const env = Number(process.env.KCA_LLM_MIN_FREE_GB);
    return Number.isFinite(env) && env >= 0 ? env : DEFAULT_MIN_FREE_GB_FOR_LLM_RETRY;
}
/** GGUF 재로드/reprompt 허용 여부 (dispose 후 reprobe 기준) */
export function canRetryLlmRam(profile, retrySize = "0.8B") {
    const headroom = memoryHeadroomForLlmLoad(profile);
    if (headroom < qwen35Entry(retrySize).minHeadroomGb)
        return false;
    if (profile.freeMemGb < minFreeGbForLlmRetry())
        return false;
    return true;
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
/**
 * 분석 예산용 LLM 단계 예약(ms) — 로드+추론.
 * 실제 타임아웃(`llmLoadTimeoutMs`)보다 짧게 잡아, 빠른 파이프라인 뒤에도 LLM 여유를 남긴다.
 */
export function llmPhaseReserveMs(size, preset) {
    if (!size)
        return 50_000;
    const entry = qwen35Entry(size);
    const loadPlan = entry.timeoutMs;
    const inferPlan = llmInferTimeoutMs(size);
    let reserve = loadPlan + inferPlan + 5_000;
    if (size === "9B" && (preset === "quality" || preset === "ultra")) {
        reserve = Math.max(reserve, 120_000);
    }
    else if (size === "9B") {
        reserve = Math.max(reserve, 100_000);
    }
    else if (size === "4B") {
        reserve = Math.max(reserve, 75_000);
    }
    return reserve;
}
//# sourceMappingURL=llm-resolve.js.map