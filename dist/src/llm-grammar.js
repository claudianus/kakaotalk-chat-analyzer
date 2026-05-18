import { buildKcaLlmJsonSchema } from "./llm-schema.js";
let grammarPromise = null;
/** `KCA_LLM_GRAMMAR=0` 이면 prompt-only (legacy) */
export function isLlmGrammarEnabled() {
    return process.env.KCA_LLM_GRAMMAR !== "0";
}
export async function getKcaLlmGrammar(llama) {
    if (!isLlmGrammarEnabled())
        return null;
    if (!grammarPromise) {
        grammarPromise = llama.createGrammarForJsonSchema(buildKcaLlmJsonSchema()).catch((error) => {
            grammarPromise = null;
            throw error;
        });
    }
    return grammarPromise;
}
/** 테스트·재로드용 */
export function resetKcaLlmGrammarCache() {
    grammarPromise = null;
}
//# sourceMappingURL=llm-grammar.js.map