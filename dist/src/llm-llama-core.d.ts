import { getKcaLlmGrammar } from "./llm-grammar.js";
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
export interface RunLlamaPromptOptions {
    modelPath: string;
    prompt: string;
    maxTokens?: number;
    /** 추론 단계 상한(ms) */
    inferTimeoutMs: number;
    /** GGUF 로드+컨텍스트 생성 상한(ms) */
    loadTimeoutMs: number;
    gpu?: LlamaGpuMode;
    /** JSON Schema for grammar-constrained generation (bypasses cached grammar) */
    grammarJsonSchema?: unknown;
}
/** Qwen3.5 instruct(non-thinking) 기본 — env로 override */
export declare function resolveLlmSamplingParams(): {
    temperature: number;
    topP: number;
    topK: number;
};
export { getKcaLlmGrammar };
export type { LlamaModelLike, LlamaContextLike, LlamaBinding };
