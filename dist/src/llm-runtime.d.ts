import { applyGgmlMetalCompatibilityEnv, resolveLlamaGpuMode, resolveLlmSamplingParams, type LlamaGpuMode, type RunLlamaPromptOptions } from "./llm-llama-core.js";
import { LlmInferProcessError, type LlmInferFailureKind } from "./llm-subprocess.js";
export { applyGgmlMetalCompatibilityEnv, resolveLlamaGpuMode, resolveLlmSamplingParams, type LlamaGpuMode, type RunLlamaPromptOptions, };
export { LlmInferProcessError };
export type { LlmInferFailureKind };
/** GGUF 추론 — 기본 child 격리 (`KCA_LLM_IN_PROCESS=1` 시 in-process) */
export declare function runLlamaPrompt(options: RunLlamaPromptOptions): Promise<string>;
