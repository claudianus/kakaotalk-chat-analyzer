import type { MachineProfile } from "./analysis-capability.js";
import type { AnalysisPresetName } from "./analysis-preset.js";

/** Qwen3.5 Instruct GGUF — 텍스트 요약·주제 보강용 */
export const QWEN35_MODELS = {
  "0.8b": "Qwen/Qwen3.5-0.8B-Instruct-GGUF",
  "2b": "Qwen/Qwen3.5-2B-Instruct-GGUF",
  "4b": "Qwen/Qwen3.5-4B-Instruct-GGUF",
} as const;

export type LlmTier = "off" | "0.8b" | "2b" | "4b";

const LLM_TIMEOUT_MS = 45_000;

export function resolveLlmTier(
  preset: AnalysisPresetName,
  profile: MachineProfile,
): LlmTier {
  if (process.env.KCA_LLM === "0") return "off";
  if (process.env.KCA_LLM_MOCK === "1") return "0.8b";
  const forced = process.env.KCA_LLM_MODEL?.trim().toLowerCase();
  if (forced === "0.8b" || forced === "2b" || forced === "4b") return forced;
  if (preset === "speed" || preset === "balanced") {
    return process.env.KCA_LLM === "1" ? "2b" : "off";
  }
  if (preset !== "quality" && preset !== "custom") return "off";
  if (process.env.KCA_LLM !== "1" && preset === "custom") return "off";
  if (preset === "custom" && process.env.KCA_LLM === "1" && forced !== "9b") return "2b";
  if (profile.freeMemGb < 8) return "off";
  if (forced === "9b") {
    if (preset === "custom") {
      process.stderr.write(
        "[kca] Qwen3.5-9B는 custom 전용입니다. node-llama-cpp 대신 KCA_LLM_BACKEND=ollama 를 권장합니다.\n",
      );
    }
    if (profile.freeMemGb >= 20) return "4b";
    return "off";
  }
  if (preset === "quality" && profile.freeMemGb >= 14) return "4b";
  return "2b";
}

export function llmTimeoutMs(): number {
  const env = Number(process.env.KCA_LLM_TIMEOUT_MS);
  return Number.isFinite(env) && env > 0 ? env : LLM_TIMEOUT_MS;
}

export function qwenModelIdForTier(tier: LlmTier): string | undefined {
  if (tier === "off") return undefined;
  return QWEN35_MODELS[tier];
}
