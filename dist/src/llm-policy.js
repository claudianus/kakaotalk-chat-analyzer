import { qwen35Entry, parseQwen35Size } from "./llm-qwen35.js";
import { resolveLlmRunPlan } from "./llm-resolve.js";
export { resolveLlmRunPlan, pickLargestQwen35ForRam, isLlmAutoEnabled, llmPhaseReserveMs, llmLoadTimeoutMs, llmInferTimeoutMs, memoryHeadroomForLlmLoad, llmRamReserveGb, } from "./llm-resolve.js";
export { parseQwen35Size } from "./llm-qwen35.js";
const LLM_TIMEOUT_MS = 45_000;
export function resolveLlmRunPlanForPreset(preset, profile, messageCount) {
    return resolveLlmRunPlan({ preset, profile, messageCount });
}
/** @deprecated resolveLlmRunPlan().enabled / .size 사용 */
export function resolveLlmTier(preset, profile) {
    const plan = resolveLlmRunPlan({ preset, profile });
    if (!plan.enabled || !plan.size)
        return "off";
    return plan.size;
}
/** @deprecated parseQwen35Size 사용 */
export function parseLlmTierName(raw) {
    const size = parseQwen35Size(raw);
    return size ?? undefined;
}
export function llmTimeoutMs() {
    const env = Number(process.env.KCA_LLM_TIMEOUT_MS);
    return Number.isFinite(env) && env > 0 ? env : LLM_TIMEOUT_MS;
}
export function qwenModelIdForPlan(plan) {
    if (!plan.enabled || !plan.size)
        return undefined;
    return plan.hubId ?? qwen35Entry(plan.size).gguf.hubId;
}
/** @deprecated */
export function qwenModelIdForTier(tier) {
    if (tier === "off")
        return undefined;
    return qwen35Entry(tier).gguf.hubId;
}
//# sourceMappingURL=llm-policy.js.map