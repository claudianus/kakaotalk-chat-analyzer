import { platform } from "node:os";
import { getKcaLlmGrammar } from "./llm-grammar.js";
/** `KCA_LLM_GPU`: none | metal | auto (기본 auto) */
export function resolveLlamaGpuMode() {
    const raw = process.env.KCA_LLM_GPU?.trim().toLowerCase();
    if (raw === "none" || raw === "cpu" || raw === "false" || raw === "0")
        return "none";
    if (raw === "metal" || raw === "gpu" || raw === "1")
        return "metal";
    return "auto";
}
/** macOS Metal tensor 프로브 실패 시 stderr·비활성 완화 */
export function applyGgmlMetalCompatibilityEnv() {
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
/** JSON deck 전체를 닫기 전 잘리던 768 — grammar 출력 상한 */
const DEFAULT_LLM_MAX_TOKENS = 2048;
const DEFAULT_LLM_CONTEXT_SIZE = 8192;
const MIN_LLM_CONTEXT_SIZE = 4096;
const MAX_LLM_CONTEXT_SIZE = 16_384;
/** `KCA_LLM_MAX_TOKENS` (기본 2048, 상한 8192) */
export function resolveLlmMaxTokens() {
    const env = Number(process.env.KCA_LLM_MAX_TOKENS);
    if (Number.isFinite(env) && env >= 256) {
        return Math.min(Math.round(env), 8192);
    }
    return DEFAULT_LLM_MAX_TOKENS;
}
/** `KCA_LLM_CONTEXT_SIZE` — prompt+출력 합이 넘지 않게 maxTokens+여유(2048) 이상 */
export function resolveLlmContextSize() {
    const maxTokens = resolveLlmMaxTokens();
    const env = Number(process.env.KCA_LLM_CONTEXT_SIZE);
    let ctx = Number.isFinite(env) && env >= MIN_LLM_CONTEXT_SIZE
        ? Math.round(env)
        : DEFAULT_LLM_CONTEXT_SIZE;
    ctx = Math.max(ctx, maxTokens + 2048);
    return Math.min(ctx, MAX_LLM_CONTEXT_SIZE);
}
/** Qwen3.5 instruct(non-thinking) 기본 — env로 override */
export function resolveLlmSamplingParams(override) {
    const temp = Number(process.env.KCA_LLM_TEMPERATURE);
    const topP = Number(process.env.KCA_LLM_TOP_P);
    const topK = Number(process.env.KCA_LLM_TOP_K);
    const base = {
        temperature: Number.isFinite(temp) && temp >= 0 ? temp : 0.7,
        topP: Number.isFinite(topP) && topP > 0 && topP <= 1 ? topP : 0.8,
        topK: Number.isFinite(topK) && topK >= 0 ? topK : 20,
    };
    if (!override)
        return base;
    return {
        temperature: override.temperature !== undefined && Number.isFinite(override.temperature) && override.temperature >= 0
            ? override.temperature
            : base.temperature,
        topP: override.topP !== undefined && Number.isFinite(override.topP) && override.topP > 0 && override.topP <= 1
            ? override.topP
            : base.topP,
        topK: override.topK !== undefined && Number.isFinite(override.topK) && override.topK >= 0
            ? override.topK
            : base.topK,
    };
}
/** SLM·구조화 출력용 샘플링 — repair는 더 낮은 temperature (JSONSchemaBench·STROT 계열) */
export function resolveLlmSamplingForStructured(args) {
    if (args.override) {
        return resolveLlmSamplingParams(args.override);
    }
    if (args.repairAttempt) {
        return resolveLlmSamplingParams({ temperature: 0.25, topP: 0.75, topK: 12 });
    }
    if (args.size === "0.8B") {
        return resolveLlmSamplingParams({ temperature: 0.45, topP: 0.75, topK: 15 });
    }
    if (args.size === "2B") {
        return resolveLlmSamplingParams({ temperature: 0.55, topP: 0.8, topK: 18 });
    }
    return resolveLlmSamplingParams({ temperature: 0.65, topP: 0.8, topK: 20 });
}
export { getKcaLlmGrammar };
//# sourceMappingURL=llm-llama-core.js.map