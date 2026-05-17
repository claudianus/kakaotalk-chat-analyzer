type TransformersModule = typeof import("@xenova/transformers");
export declare function huggingFaceAccessToken(): string | undefined;
/** cwd의 tokenizer.json이 hub 모델 로드를 깨는 경우 경고 */
export declare function warnCwdTokenizerShadow(): void;
export declare function applyTransformersEnv(mod: TransformersModule, cacheDir?: string): void;
export declare function isTransformersFetchError(error: unknown): boolean;
export {};
