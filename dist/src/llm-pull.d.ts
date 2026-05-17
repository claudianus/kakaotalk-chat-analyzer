import type { LlmTier } from "./llm-policy.js";
export declare function parsePullTier(raw: string): Exclude<LlmTier, "off">;
export declare function pullLlmGguf(tier: Exclude<LlmTier, "off">): Promise<string>;
