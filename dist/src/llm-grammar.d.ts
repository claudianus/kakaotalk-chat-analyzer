type KcaLlmGrammar = {
    parse: (json: string) => unknown;
};
type LlamaGrammarHost = {
    createGrammarForJsonSchema: (schema: unknown) => Promise<KcaLlmGrammar>;
};
/** `KCA_LLM_GRAMMAR=0` 이면 prompt-only (legacy) */
export declare function isLlmGrammarEnabled(): boolean;
export declare function getKcaLlmGrammar(llama: LlamaGrammarHost): Promise<KcaLlmGrammar | null>;
/** 테스트·재로드용 */
export declare function resetKcaLlmGrammarCache(): void;
export {};
