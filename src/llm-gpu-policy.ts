import type { MachineProfile } from "./analysis-capability.js";
import type { Qwen35Size } from "./llm-qwen35.js";
import type { LlamaGpuMode } from "./llm-llama-core.js";

/** 사용자 env 우선, 없으면 post-ML free RAM 기반 안전 기본값 */
export function resolveLlmGpuForInfer(profile: MachineProfile, size: Qwen35Size): LlamaGpuMode {
  const raw = process.env.KCA_LLM_GPU?.trim().toLowerCase();
  if (raw === "none" || raw === "cpu" || raw === "false" || raw === "0") return "none";
  if (raw === "metal" || raw === "gpu" || raw === "1") return "metal";
  if (raw === "auto") return "auto";

  if (profile.freeMemGb < 4) return "none";
  if (profile.freeMemGb < 6 && (size === "9B" || size === "4B")) return "none";
  return "auto";
}
