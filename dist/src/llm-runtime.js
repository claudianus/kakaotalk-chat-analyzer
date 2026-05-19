import { runLlamaPromptInProcess } from "./llm-infer-internal.js";
import { applyGgmlMetalCompatibilityEnv, resolveLlamaGpuMode, resolveLlmSamplingParams, } from "./llm-llama-core.js";
import { LlmInferProcessError, runLlmInChildProcess, } from "./llm-subprocess.js";
export { applyGgmlMetalCompatibilityEnv, resolveLlamaGpuMode, resolveLlmSamplingParams, };
export { LlmInferProcessError };
/** GGUF 추론 — 기본 child 격리 (`KCA_LLM_IN_PROCESS=1` 시 in-process) */
export async function runLlamaPrompt(options) {
    if (process.env.KCA_LLM_IN_PROCESS === "1") {
        return runLlamaPromptInProcess(options);
    }
    const gpu = options.gpu ?? resolveLlamaGpuMode();
    const res = await runLlmInChildProcess({
        modelPath: options.modelPath,
        prompt: options.prompt,
        maxTokens: options.maxTokens,
        inferTimeoutMs: options.inferTimeoutMs,
        loadTimeoutMs: options.loadTimeoutMs,
        gpu,
    });
    if (res.ok)
        return res.text;
    throw new LlmInferProcessError(res.error, res.kind, res.exitCode, res.signal);
}
//# sourceMappingURL=llm-runtime.js.map