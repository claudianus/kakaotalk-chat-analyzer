import { getKcaLlmGrammar, getLlamaForKca, resolveLlmSamplingParams, } from "./llm-llama-core.js";
function raceTimeout(promise, timeoutMs, label) {
    let timeoutHandle;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => reject(new Error(label)), timeoutMs);
        }),
    ]).finally(() => {
        if (timeoutHandle !== undefined)
            clearTimeout(timeoutHandle);
    });
}
/** child·in-process 공용 — node-llama-cpp 직접 호출 */
export async function runLlamaPromptInProcess(options) {
    const { modelPath, prompt, maxTokens = 768, inferTimeoutMs, loadTimeoutMs } = options;
    const mod = "node-llama-cpp";
    const { LlamaChatSession } = await import(mod);
    const llama = await getLlamaForKca();
    const grammar = await getKcaLlmGrammar(llama);
    const sampling = resolveLlmSamplingParams();
    let model;
    let context;
    try {
        model = await raceTimeout(llama.loadModel({ modelPath }), loadTimeoutMs, "LLM load timeout");
        context = await raceTimeout(model.createContext({ contextSize: 4096 }), Math.min(loadTimeoutMs, 30_000), "LLM context timeout");
        const session = new LlamaChatSession({
            contextSequence: context.getSequence(),
        });
        const reply = await raceTimeout(session.prompt(prompt, {
            maxTokens,
            grammar: grammar ?? undefined,
            temperature: sampling.temperature,
            topP: sampling.topP,
            topK: sampling.topK,
            budgets: { thoughtTokens: 0 },
        }), inferTimeoutMs, "LLM timeout");
        return typeof reply === "string" ? reply : String(reply);
    }
    finally {
        await context?.dispose?.();
        await model?.dispose?.();
    }
}
//# sourceMappingURL=llm-infer-internal.js.map