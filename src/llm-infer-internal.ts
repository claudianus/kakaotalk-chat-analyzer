import {
  getKcaLlmGrammar,
  getLlamaForKca,
  resolveLlmSamplingParams,
  type LlamaBinding,
  type LlamaContextLike,
  type LlamaModelLike,
  type RunLlamaPromptOptions,
} from "./llm-llama-core.js";

function raceTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error(label)), timeoutMs);
    }),
  ]).finally(() => {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  });
}

/** child·in-process 공용 — node-llama-cpp 직접 호출 */
export async function runLlamaPromptInProcess(
  options: RunLlamaPromptOptions & { grammarJsonSchema?: unknown },
): Promise<string> {
  const { modelPath, prompt, maxTokens = 768, inferTimeoutMs, loadTimeoutMs, grammarJsonSchema } = options;
  const mod = "node-llama-cpp";
  const { LlamaChatSession } = await import(mod);
  const llama = await getLlamaForKca();
  const grammar = grammarJsonSchema
    ? await (llama as Parameters<typeof getKcaLlmGrammar>[0]).createGrammarForJsonSchema(grammarJsonSchema)
    : await getKcaLlmGrammar(llama as Parameters<typeof getKcaLlmGrammar>[0]);
  const sampling = resolveLlmSamplingParams();

  let model: LlamaModelLike | undefined;
  let context: LlamaContextLike | undefined;
  try {
    model = await raceTimeout(
      (llama as LlamaBinding).loadModel({ modelPath }),
      loadTimeoutMs,
      "LLM load timeout",
    );
    context = await raceTimeout(
      model.createContext({ contextSize: 4096 }),
      Math.min(loadTimeoutMs, 30_000),
      "LLM context timeout",
    );
    const session = new LlamaChatSession({
      contextSequence: context.getSequence(),
    });
    const reply = await raceTimeout(
      session.prompt(prompt, {
        maxTokens,
        grammar: grammar ?? undefined,
        temperature: sampling.temperature,
        topP: sampling.topP,
        topK: sampling.topK,
        budgets: { thoughtTokens: 0 },
      }),
      inferTimeoutMs,
      "LLM timeout",
    );
    return typeof reply === "string" ? reply : String(reply);
  } finally {
    await context?.dispose?.();
    await model?.dispose?.();
  }
}
