import { memoryHeadroomGb } from "./analysis-capability.js";
import { QWEN35_CATALOG, qwen35DisplayLabel, qwen35Entry, parseQwen35Size, } from "./llm-qwen35.js";
/** RAM 에 맞는 최대 Qwen3.5 (9B→4B→2B→0.8B) */
export function pickLargestQwen35ForRam(headroomGb) {
    for (const entry of QWEN35_CATALOG) {
        if (headroomGb >= entry.minHeadroomGb)
            return entry.size;
    }
    return undefined;
}
export function resolveLlmRunPlan(input) {
    const { preset, profile } = input;
    const headroom = memoryHeadroomGb(profile);
    const ramNote = `RAM ${headroom}GB`;
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
        if (headroom < e.minHeadroomGb) {
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
    const size = pickLargestQwen35ForRam(headroom);
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
/** 분석 예산용 LLM 단계 예약(ms) */
export function llmPhaseReserveMs(size, preset) {
    if (!size)
        return 50_000;
    const entry = qwen35Entry(size);
    if (size === "9B" && preset === "quality")
        return Math.max(entry.timeoutMs - 15_000, 55_000);
    if (size === "9B")
        return 75_000;
    if (size === "4B")
        return 55_000;
    return 45_000;
}
//# sourceMappingURL=llm-resolve.js.map