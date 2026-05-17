import type { BuildReportOptions } from "./analyze-pool.js";
import {
  memoryHeadroomGb,
  probeMachineProfileSync,
  type MachineProfile,
} from "./analysis-capability.js";
import type { AnalysisProfile } from "./analysis-profile.js";

export type AnalysisPresetName = "speed" | "balanced" | "quality" | "custom";

export interface PresetEffectiveFlags {
  preset: AnalysisPresetName;
  profile: AnalysisProfile;
  semanticCap?: number;
  llmEnabled: boolean;
  preferWorker: boolean;
}

function presetFromEnv(): AnalysisPresetName | undefined {
  const raw = process.env.KCA_PRESET?.trim().toLowerCase();
  if (raw === "speed" || raw === "balanced" || raw === "quality" || raw === "custom") return raw;
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

  if (total >= 32 && headroom >= 12) {
    return n >= 80_000 ? "balanced" : "quality";
  }

  if (total >= 16 && headroom >= 10) {
    return n >= 40_000 ? "balanced" : "quality";
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
export function presetForcesSemanticOff(options?: BuildReportOptions): boolean {
  return resolvePresetName(options) === "speed";
}

export function presetForcesSentimentOff(options?: BuildReportOptions): boolean {
  const p = resolvePresetName(options);
  return p === "speed" || p === "balanced";
}
