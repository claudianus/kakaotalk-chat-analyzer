import { totalmem, cpus, platform, arch } from "node:os";
import { formatMemoryLine, probeAvailableMemoryBytes, probeFreeMemoryBytes, } from "./memory-probe.js";
import { resolveLlmRunPlan } from "./llm-resolve.js";
import { qwen35DisplayLabel } from "./llm-qwen35.js";
import { probeOnnxGpu } from "./ml-runtime.js";
export function memoryHeadroomGb(profile) {
    return profile.availableMemGb ?? profile.freeMemGb;
}
export function probeMachineProfileSync() {
    const totalMemGb = totalmem() / 1024 ** 3;
    const freeMemGb = probeFreeMemoryBytes() / 1024 ** 3;
    const availableMemGb = probeAvailableMemoryBytes() / 1024 ** 3;
    return {
        totalMemGb: Math.round(totalMemGb * 10) / 10,
        freeMemGb: Math.round(freeMemGb * 10) / 10,
        availableMemGb: Math.round(availableMemGb * 10) / 10,
        cpuCores: cpus().length,
        platform: platform(),
        arch: arch(),
        gpu: "none",
    };
}
export async function probeMachineProfile() {
    const base = probeMachineProfileSync();
    const gpu = await probeOnnxGpu();
    return { ...base, gpu };
}
/** preset·RAM 기준 분석 SLA 상한(ms). 코퍼스 추정 시간과 무관하게 고정 — 단계 skip은 경과 시간으로 판단 */
export function analysisBudgetMs(preset, _messageCount, profile) {
    const headroom = memoryHeadroomGb(profile);
    let cap = preset === "speed"
        ? 180_000
        : preset === "balanced"
            ? 300_000
            : preset === "quality"
                ? 360_000
                : preset === "ultra"
                    ? 480_000
                    : 300_000;
    if (headroom >= 20 && profile.totalMemGb >= 48) {
        if (preset === "ultra")
            cap = 600_000;
        else if (preset === "quality")
            cap = 480_000;
        else if (preset === "balanced")
            cap = 420_000;
        else if (preset === "speed")
            cap = 240_000;
    }
    else if (headroom >= 16) {
        if (preset === "ultra")
            cap = 540_000;
        else if (preset === "quality")
            cap = 420_000;
        else if (preset === "balanced")
            cap = 360_000;
        else if (preset === "speed")
            cap = 210_000;
    }
    return cap;
}
/** 90k 메시지 기준 대략 예상(초) — preset·RAM 휴리스틱 */
export function estimateAnalysisSeconds(preset, messageCount, profile) {
    const n = Math.max(messageCount, 1);
    const base = n / 900;
    const headroom = memoryHeadroomGb(profile);
    const memFactor = headroom < 6 ? 1.4 : headroom < 12 ? 1.1 : 1;
    const presetFactor = preset === "speed"
        ? 0.55
        : preset === "balanced"
            ? 1
            : preset === "quality"
                ? 1.45
                : preset === "ultra"
                    ? 1.85
                    : 1.1;
    return Math.max(1, Math.round(base * memFactor * presetFactor));
}
export function formatCapabilitiesReport(profile, opts) {
    const lines = [
        formatMemoryLine(profile),
        `CPU: ${profile.cpuCores} cores · ${profile.platform}/${profile.arch}`,
        `GPU (ONNX): ${profile.gpu}`,
    ];
    if (opts?.preset) {
        lines.push(`Preset: ${opts.preset}`);
        const llmPlan = resolveLlmRunPlan({
            preset: opts.preset,
            profile,
            messageCount: opts.messageCount,
        });
        if (llmPlan.enabled && llmPlan.size) {
            lines.push(`LLM: ${qwen35DisplayLabel(llmPlan.size)} (${llmPlan.reason})`);
        }
        else {
            lines.push(`LLM: off (${llmPlan.reason})`);
        }
        if (opts.messageCount) {
            lines.push(`Estimated analysis: ~${estimateAnalysisSeconds(opts.preset, opts.messageCount, profile)}s (${opts.messageCount.toLocaleString("ko-KR")} messages)`);
        }
    }
    return lines.join("\n");
}
//# sourceMappingURL=analysis-capability.js.map