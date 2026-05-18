export type LlamaGpuMode = "none" | "metal" | "auto";
/** `KCA_LLM_GPU`: none | metal | auto (기본 auto) */
export declare function resolveLlamaGpuMode(): LlamaGpuMode;
/** macOS 26+ Metal tensor 프로브 실패 시 stderr·비활성 완화 */
export declare function applyGgmlMetalCompatibilityEnv(): void;
type GetLlamaFn = (options?: {
    gpu?: false;
}) => Promise<{
    loadModel: (opts: {
        modelPath: string;
    }) => Promise<LlamaModelLike>;
}>;
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
export declare function getLlamaForKca(): Promise<Awaited<ReturnType<GetLlamaFn>>>;
export interface RunLlamaPromptOptions {
    modelPath: string;
    prompt: string;
    maxTokens?: number;
    timeoutMs: number;
}
/** GGUF 로드 → 채팅 1회 → 리소스 해제 */
export declare function runLlamaPrompt(options: RunLlamaPromptOptions): Promise<string>;
export {};
