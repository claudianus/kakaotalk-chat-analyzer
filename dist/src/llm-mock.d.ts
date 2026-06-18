/** 테스트·벤치용 LLM mock — KCA_LLM_MOCK 시퀀스·시나리오 지원 */
export declare function resetLlmMockCallIndex(): void;
export declare function isLlmMockEnabled(): boolean;
/** KCA_LLM_MOCK 시나리오별 raw LLM 출력 (또는 throw) */
export declare function runLlmMockCompletion(): Promise<string>;
