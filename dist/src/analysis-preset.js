import { probeMachineProfileSync } from "./analysis-capability.js";
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
/** CLI 인자 없을 때 RAM·메시지 수 기반 자동 preset */
export function autoPresetFromMachine(profile, messageCount) {
    if (profile.freeMemGb < 6)
        return "speed";
    if (profile.freeMemGb < 12)
        return "balanced";
    const n = messageCount ?? 0;
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
    if (preset === "speed") {
        return { preset, profile: "fast", llmEnabled: false, preferWorker: true };
    }
    if (preset === "balanced") {
        return {
            preset,
            profile: "quality",
            semanticCap: 600,
            llmEnabled: false,
            preferWorker: false,
        };
    }
    if (preset === "quality") {
        return {
            preset,
            profile: "quality",
            semanticCap: 1200,
            llmEnabled: process.env.KCA_LLM === "1",
            preferWorker: false,
        };
    }
    return {
        preset: "custom",
        profile: process.env.KCA_PROFILE === "fast" ? "fast" : "quality",
        llmEnabled: process.env.KCA_LLM === "1",
        preferWorker: options?.worker === true,
    };
}
/** 명시적 preset·legacy fast만 끔(RAM 자동 speed는 CLI 추천용) */
export function presetForcesSemanticOff(options) {
    return resolvePresetName(options) === "speed";
}
export function presetForcesSentimentOff(options) {
    const p = resolvePresetName(options);
    return p === "speed" || p === "balanced";
}
//# sourceMappingURL=analysis-preset.js.map