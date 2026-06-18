import { getKcaLlmGrammar } from "./llm-grammar.js";
import type { Qwen35Size } from "./llm-qwen35.js";
export type LlamaGpuMode = "none" | "metal" | "auto";
/** `KCA_LLM_GPU`: none | metal | auto (기본 auto) */
export declare function resolveLlamaGpuMode(): LlamaGpuMode;
/** macOS Metal tensor 프로브 실패 시 stderr·비활성 완화 */
export declare function applyGgmlMetalCompatibilityEnv(): void;
type LlamaBinding = {
    loadModel: (opts: {
        modelPath: string;
    }) => Promise<LlamaModelLike>;
    createGrammarForJsonSchema: (schema: unknown) => Promise<LlamaGrammarLike>;
};
interface LlamaGrammarLike {
    parse: (json: string) => unknown;
}
interface LlamaModelLike {
    createContext: (opts: {
        contextSize: number;
    }) => Promise<LlamaContextLike>;
    dispose?: () => Promise<void>;
}
interface LlamaContextLike {
    getSequence: () => unknown;
    dispose?: () => Promise<void>;
}
/** node-llama-cpp `getLlama` — auto 시 Metal 실패하면 CPU 1회 재시도 */
export declare function getLlamaForKca(): Promise<LlamaBinding>;
/** `KCA_LLM_MAX_TOKENS` (기본 2048, 상한 8192) */
export declare function resolveLlmMaxTokens(): number;
/** `KCA_LLM_CONTEXT_SIZE` — prompt+출력 합이 넘지 않게 maxTokens+여유(2048) 이상 */
export declare function resolveLlmContextSize(): number;
export interface LlmSamplingOverride {
    temperature?: number;
    topP?: number;
    topK?: number;
}
export interface RunLlamaPromptOptions {
    modelPath: string;
    /** user turn — 통계·키워드 입력 */
    prompt: string;
    /** chat template system role (node-llama-cpp 권장) */
    systemPrompt?: string;
    maxTokens?: number;
    /** 추론 단계 상한(ms) */
    inferTimeoutMs: number;
    /** GGUF 로드+컨텍스트 생성 상한(ms) */
    loadTimeoutMs: number;
    gpu?: LlamaGpuMode;
    /** JSON Schema for grammar-constrained generation (bypasses cached grammar) */
    grammarJsonSchema?: unknown;
    sampling?: LlmSamplingOverride;
}
/** Qwen3.5 instruct(non-thinking) 기본 — env로 override */
export declare function resolveLlmSamplingParams(override?: LlmSamplingOverride): {
    temperature: number;
    topP: number;
    topK: number;
};
/** SLM·구조화 출력용 샘플링 — repair는 더 낮은 temperature (JSONSchemaBench·STROT 계열) */
export declare function resolveLlmSamplingForStructured(args: {
    size: Qwen35Size;
    repairAttempt?: boolean;
    override?: LlmSamplingOverride;
}): {
    temperature: number;
    topP: number;
    topK: number;
};
export { getKcaLlmGrammar };
export type { LlamaModelLike, LlamaContextLike, LlamaBinding };
