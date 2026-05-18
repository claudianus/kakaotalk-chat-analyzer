import { buildKcaLlmJsonSchema } from "./llm-schema.js";

type KcaLlmGrammar = { parse: (json: string) => unknown };
type LlamaGrammarHost = {
  createGrammarForJsonSchema: (schema: unknown) => Promise<KcaLlmGrammar>;
};

let grammarPromise: Promise<KcaLlmGrammar> | null = null;

/** `KCA_LLM_GRAMMAR=0` 이면 prompt-only (legacy) */
export function isLlmGrammarEnabled(): boolean {
  return process.env.KCA_LLM_GRAMMAR !== "0";
}

export async function getKcaLlmGrammar(llama: LlamaGrammarHost): Promise<KcaLlmGrammar | null> {
  if (!isLlmGrammarEnabled()) return null;
  if (!grammarPromise) {
    grammarPromise = llama.createGrammarForJsonSchema(buildKcaLlmJsonSchema());
  }
  return grammarPromise;
}

/** 테스트·재로드용 */
export function resetKcaLlmGrammarCache(): void {
  grammarPromise = null;
}
