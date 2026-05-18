import { platform } from "node:os";
/** `KCA_LLM_GPU`: none | metal | auto (기본 auto) */
export function resolveLlamaGpuMode() {
    const raw = process.env.KCA_LLM_GPU?.trim().toLowerCase();
    if (raw === "none" || raw === "cpu" || raw === "false" || raw === "0")
        return "none";
    if (raw === "metal" || raw === "gpu" || raw === "1")
        return "metal";
    return "auto";
}
/** macOS 26+ Metal tensor 프로브 실패 시 stderr·비활성 완화 */
export function applyGgmlMetalCompatibilityEnv() {
    if (resolveLlamaGpuMode() === "metal")
        return;
    if (platform() !== "darwin")
        return;
    if (process.env.GGML_METAL_TENSOR_DISABLE != null)
        return;
    process.env.GGML_METAL_TENSOR_DISABLE = "1";
}
let cpuFallbackNotified = false;
function notifyCpuFallback() {
    if (cpuFallbackNotified)
        return;
    cpuFallbackNotified = true;
    process.stderr.write("[kca] LLM: Metal 비활성 → CPU 추론 (macOS 호환)\n");
}
function isMetalInitFailure(error) {
    const msg = error instanceof Error ? error.message : String(error);
    const lower = msg.toLowerCase();
    return (lower.includes("metal") ||
        lower.includes("ggml") ||
        lower.includes("gpu") ||
        lower.includes("mps"));
}
/** node-llama-cpp `getLlama` — auto 시 Metal 실패하면 CPU 1회 재시도 */
export async function getLlamaForKca() {
    applyGgmlMetalCompatibilityEnv();
    const mod = "node-llama-cpp";
    const { getLlama } = (await import(mod));
    const mode = resolveLlamaGpuMode();
    if (mode === "none") {
        return getLlama({ gpu: false });
    }
    try {
        return await getLlama();
    }
    catch (error) {
        if (mode === "metal")
            throw error;
        if (!isMetalInitFailure(error))
            throw error;
        notifyCpuFallback();
        return getLlama({ gpu: false });
    }
}
/** GGUF 로드 → 채팅 1회 → 리소스 해제 */
export async function runLlamaPrompt(options) {
    const { modelPath, prompt, maxTokens = 768, timeoutMs } = options;
    const mod = "node-llama-cpp";
    const { LlamaChatSession } = await import(mod);
    const llama = await getLlamaForKca();
    const model = await llama.loadModel({ modelPath });
    const context = await model.createContext({ contextSize: 4096 });
    const session = new LlamaChatSession({
        contextSequence: context.getSequence(),
    });
    let timeoutHandle;
    try {
        const run = session.prompt(prompt, { maxTokens });
        const timed = Promise.race([
            run,
            new Promise((_, reject) => {
                timeoutHandle = setTimeout(() => reject(new Error("LLM timeout")), timeoutMs);
            }),
        ]);
        const reply = await timed;
        return typeof reply === "string" ? reply : String(reply);
    }
    finally {
        if (timeoutHandle !== undefined)
            clearTimeout(timeoutHandle);
        await context.dispose?.();
        await model.dispose?.();
    }
}
//# sourceMappingURL=llm-runtime.js.map