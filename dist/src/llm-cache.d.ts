import type { LlmTier } from "./llm-policy.js";
/** Hugging Face GGUF (Q4_K_M). Qwen3.5 공개 시 env로 교체 가능 */
export declare const TIER_GGUF: Record<Exclude<LlmTier, "off">, {
    repo: string;
    file: string;
}>;
export declare function llmCacheRoot(): string;
export declare function ggufPathForTier(tier: Exclude<LlmTier, "off">): string;
export declare function hfDownloadUrl(repo: string, file: string): string;
