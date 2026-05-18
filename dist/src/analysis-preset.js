import { memoryHeadroomGb, probeMachineProfileSync, } from "./analysis-capability.js";
function presetFromEnv() {
    const raw = process.env.KCA_PRESET?.trim().toLowerCase();
    if (raw === "speed" || raw === "balanced" || raw === "quality" || raw === "custom")
        return raw;
    return undefined;
}
export function resolvePresetName(options) {
    if (options?.preset)
        return options.preset;
    const env = presetFromEnv();
    if (env)
        return env;
    if (options?.worker === true || process.env.KCA_PROFILE === "fast")
        return "speed";
    return "balanced";
}
/** CLI 인자 없을 때 가용 RAM·총 RAM·메시지 수 기반 자동 preset (품질 우선) */
export function autoPresetFromMachine(profile, messageCount) {
    const headroom = memoryHeadroomGb(profile);
    const total = profile.totalMemGb;
    const n = messageCount ?? 0;
    if (headroom < 4 || (headroom < 6 && total < 16))
        return "speed";
    if (total >= 32 && headroom >= 16) {
        return n >= 120_000 ? "balanced" : "quality";
    }
    if (total >= 32 && headroom >= 12) {
        return n >= 100_000 ? "balanced" : "quality";
    }
    if (total >= 16 && headroom >= 14) {
        return n >= 60_000 ? "balanced" : "quality";
    }
    if (total >= 16 && headroom >= 10) {
        return n >= 45_000 ? "balanced" : "quality";
    }
    if (headroom < 8)
        return "speed";
    if (headroom < 12)
        return "balanced";
    if (n >= 30_000)
        return "balanced";
    return "quality";
}
export function resolvePresetNameWithAuto(options, messageCount) {
    if (options?.preset || presetFromEnv() || options?.worker === true || process.env.KCA_PROFILE === "fast") {
        return resolvePresetName(options);
    }
    return autoPresetFromMachine(probeMachineProfileSync(), messageCount);
}
export function getPresetEffectiveFlags(options, messageCount) {
    const preset = messageCount !== undefined ? resolvePresetNameWithAuto(options, messageCount) : resolvePresetName(options);
    const llmEnabled = process.env.KCA_LLM !== "0";
    if (preset === "speed") {
        return { preset, profile: "fast", llmEnabled, preferWorker: true };
    }
    if (preset === "balanced") {
        const headroom = memoryHeadroomGb(probeMachineProfileSync());
        return {
            preset,
            profile: "quality",
            semanticCap: headroom >= 16 ? 900 : 600,
            llmEnabled,
            preferWorker: false,
        };
    }
    if (preset === "quality") {
        return {
            preset,
            profile: "quality",
            semanticCap: 1200,
            llmEnabled,
            preferWorker: false,
        };
    }
    return {
        preset: "custom",
        profile: process.env.KCA_PROFILE === "fast" ? "fast" : "quality",
        llmEnabled,
        preferWorker: options?.worker === true,
    };
}
/** 명시적 preset·legacy fast만 끔(RAM 자동 speed는 CLI 추천용) */
export function presetForcesSemanticOff(options) {
    return resolvePresetName(options) === "speed";
}
export function presetForcesSentimentOff(options, messageCount) {
    const p = messageCount !== undefined
        ? resolvePresetNameWithAuto(options, messageCount)
        : resolvePresetName(options);
    if (p === "speed")
        return true;
    if (p === "balanced") {
        return memoryHeadroomGb(probeMachineProfileSync()) < 12;
    }
    return false;
}
//# sourceMappingURL=analysis-preset.js.map