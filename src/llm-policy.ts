import type { MachineProfile } from "./analysis-capability.js";
import type { AnalysisPresetName } from "./analysis-preset.js";
import { qwen35DisplayLabel, qwen35Entry, parseQwen35Size, type Qwen35Size } from "./llm-qwen35.js";
import { resolveLlmRunPlan, type LlmRunPlan } from "./llm-resolve.js";

export type { Qwen35Size } from "./llm-qwen35.js";
export type { LlmRunPlan } from "./llm-resolve.js";
export {
  resolveLlmRunPlan,
  pickLargestQwen35ForRam,
  isLlmAutoEnabled,
  llmPhaseReserveMs,
  llmLoadTimeoutMs,
  llmInferTimeoutMs,
  memoryHeadroomForLlmLoad,
  llmRamReserveGb,
  canRetryLlmRam,
  minFreeGbForLlmRetry,
} from "./llm-resolve.js";
export { parseQwen35Size } from "./llm-qwen35.js";

const LLM_TIMEOUT_MS = 45_000;

/** @deprecated LlmRunPlan 사용 */
export type LlmTier = "off" | Qwen35Size;

export function resolveLlmRunPlanForPreset(
  preset: AnalysisPresetName,
  profile: MachineProfile,
  messageCount?: number,
): LlmRunPlan {
  return resolveLlmRunPlan({ preset, profile, messageCount });
}

/** @deprecated resolveLlmRunPlan().enabled / .size 사용 */
export function resolveLlmTier(preset: AnalysisPresetName, profile: MachineProfile): LlmTier {
  const plan = resolveLlmRunPlan({ preset, profile });
  if (!plan.enabled || !plan.size) return "off";
  return plan.size;
}

/** @deprecated parseQwen35Size 사용 */
export function parseLlmTierName(raw: string): LlmTier | undefined {
  const size = parseQwen35Size(raw);
  return size ?? undefined;
}

export function llmTimeoutMs(): number {
  const env = Number(process.env.KCA_LLM_TIMEOUT_MS);
  return Number.isFinite(env) && env > 0 ? env : LLM_TIMEOUT_MS;
}

export function qwenModelIdForPlan(plan: LlmRunPlan): string | undefined {
  if (!plan.enabled || !plan.size) return undefined;
  return plan.hubId ?? qwen35Entry(plan.size).gguf.hubId;
}

/** @deprecated */
export function qwenModelIdForTier(tier: LlmTier): string | undefined {
  if (tier === "off") return undefined;
  return qwen35Entry(tier).gguf.hubId;
}
