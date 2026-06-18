/** node-llama grammar 스키마와 동일한 Ajv 검증 */
export declare function validateLlmJsonShape(data: unknown): boolean;
/** 테스트·provenance용 — 최대 3건 */
export declare function llmJsonValidationErrors(data: unknown): string[];
/** Ajv 캐시 초기화 (테스트) */
export declare function resetLlmJsonValidatorForTest(): void;
