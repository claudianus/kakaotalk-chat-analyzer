import { homedir } from "node:os";
import { join } from "node:path";
import type { LlmTier } from "./llm-policy.js";

/** Hugging Face GGUF (Q4_K_M). Qwen3.5 공개 시 env로 교체 가능 */
export const TIER_GGUF: Record<Exclude<LlmTier, "off">, { repo: string; file: string }> = {
  "0.8b": {
    repo: "Qwen/Qwen2.5-0.5B-Instruct-GGUF",
    file: "qwen2.5-0.5b-instruct-q4_k_m.gguf",
  },
  "2b": {
    repo: "Qwen/Qwen2.5-1.5B-Instruct-GGUF",
    file: "qwen2.5-1.5b-instruct-q4_k_m.gguf",
  },
  "4b": {
    repo: "Qwen/Qwen3-4B-GGUF",
    file: "Qwen3-4B-Q4_K_M.gguf",
  },
  "8b": {
    repo: "Qwen/Qwen3-8B-GGUF",
    file: "Qwen3-8B-Q4_K_M.gguf",
  },
};

export function llmCacheRoot(): string {
  return process.env.KCA_LLM_CACHE?.trim() || join(homedir(), ".cache", "kakaotalk-chat-analyzer", "llm");
}

export function ggufPathForTier(tier: Exclude<LlmTier, "off">): string {
  const custom = process.env.KCA_LLM_GGUF_PATH?.trim();
  if (custom) return custom;
  const { file } = TIER_GGUF[tier];
  return join(llmCacheRoot(), tier, file);
}

export function hfDownloadUrl(repo: string, file: string): string {
  return `https://huggingface.co/${repo}/resolve/main/${file}`;
}
