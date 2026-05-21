import type { BuildReportOptions } from "./analyze-pool.js";
import {
  memoryHeadroomGb,
  probeMachineProfileSync,
  type MachineProfile,
} from "./analysis-capability.js";
import type { AnalysisProfile } from "./analysis-profile.js";

export type AnalysisPresetName = "speed" | "balanced" | "quality" | "ultra" | "custom";

export interface PresetEffectiveFlags {
  preset: AnalysisPresetName;
  profile: AnalysisProfile;
  semanticCap?: number;
  llmEnabled: boolean;
  preferWorker: boolean;
}

function presetFromEnv(): AnalysisPresetName | undefined {
  const raw = process.env.KCA_PRESET?.trim().toLowerCase();
  if (
    raw === "speed" ||
    raw === "balanced" ||
    raw === "quality" ||
    raw === "ultra" ||
    raw === "custom"
  ) {
    return raw;
  }
  return undefined;
}

export function resolvePresetName(options?: BuildReportOptions): AnalysisPresetName {
  if (options?.preset) return options.preset;
  const env = presetFromEnv();
  if (env) return env;
  if (options?.worker === true || process.env.KCA_PROFILE === "fast") return "speed";
  return "balanced";
}

/** CLI 인자 없을 때 가용 RAM·총 RAM·메시지 수 기반 자동 preset (품질 우선) */
export function autoPresetFromMachine(
  profile: MachineProfile,
  messageCount?: number,
): AnalysisPresetName {
  const headroom = memoryHeadroomGb(profile);
  const total = profile.totalMemGb;
  const n = messageCount ?? 0;

  if (headroom < 4 || (headroom < 6 && total < 16)) return "speed";

  // 48GB+는 메시지 수 관계없이 풀퀄리티 우선
  if (total >= 48 && headroom >= 20) return "ultra";
  if (total >= 48 && headroom >= 14) return n >= 150_000 ? "quality" : "ultra";

  if (total >= 32 && headroom >= 18) {
    if (n >= 130_000) return "balanced";
    if (n >= 90_000) return "quality";
    return "ultra";
  }

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

  if (headroom < 8) return "speed";
  if (headroom < 12) return "balanced";
  if (n >= 30_000) return "balanced";
  return "quality";
}

export function resolvePresetNameWithAuto(
  options?: BuildReportOptions,
  messageCount?: number,
): AnalysisPresetName {
  if (options?.preset || presetFromEnv() || options?.worker === true || process.env.KCA_PROFILE === "fast") {
    return resolvePresetName(options);
  }
  return autoPresetFromMachine(probeMachineProfileSync(), messageCount);
}

export function getPresetEffectiveFlags(
  options?: BuildReportOptions,
  messageCount?: number,
): PresetEffectiveFlags {
  const preset =
    messageCount !== undefined ? resolvePresetNameWithAuto(options, messageCount) : resolvePresetName(options);
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
  if (preset === "ultra") {
    const headroom = memoryHeadroomGb(probeMachineProfileSync());
    return {
      preset,
      profile: "quality",
      semanticCap: headroom >= 20 ? 1800 : 1500,
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
export function presetForcesSemanticOff(options?: BuildReportOptions): boolean {
  return resolvePresetName(options) === "speed";
}

export function presetForcesSentimentOff(
  options?: BuildReportOptions,
  messageCount?: number,
): boolean {
  const p =
    messageCount !== undefined
      ? resolvePresetNameWithAuto(options, messageCount)
      : resolvePresetName(options);
  if (p === "speed") return true;
  if (p === "balanced") {
    return memoryHeadroomGb(probeMachineProfileSync()) < 12;
  }
  return false;
}
