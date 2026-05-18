type TransformersModule = typeof import("@xenova/transformers");
/** 공개 Xenova 모델 — 만료·잘못된 HF 토큰이 401을 유발할 수 있어 기본은 헤더 미전송 */
export declare function clearHubTokensForPublicFetch(): Map<string, string | undefined>;
export declare function restoreHubTokens(saved: Map<string, string | undefined>): void;
export declare function hubMirrorHosts(): readonly string[];
/**
 * Hugging Face Hub 미러 순회 + 공개 모델용 토큰 제거.
 * `KCA_USE_HF_TOKEN=1` 이면 환경 토큰을 그대로 둡니다(게이트 모델·비공개 캐시용).
 */
export declare function runWithHubMirrors<T>(mod: TransformersModule, fn: () => Promise<T>): Promise<T>;
export {};
