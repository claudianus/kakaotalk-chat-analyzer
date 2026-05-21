type TransformersModule = typeof import("@xenova/transformers");
export declare function huggingFaceAccessToken(): string | undefined;
/** cwd의 tokenizer.json이 hub 모델 로드를 깨는 경우 경고 */
export declare function warnCwdTokenizerShadow(): void;
export declare function applyTransformersEnv(mod: TransformersModule, cacheDir?: string): void;
/**
 * 로컬 번들 로드 시 HF Hub 폰백을 차단합니다.
 * 로컬에 파일이 있으면 로컬에서만 로드되고, 없으면 오류를 발생시킵니다.
 */
export declare function withLocalModelsOnly<T>(mod: TransformersModule, fn: () => Promise<T>): Promise<T>;
export declare function isTransformersFetchError(error: unknown): boolean;
export {};
