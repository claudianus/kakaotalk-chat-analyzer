type TransformersModule = typeof import("@xenova/transformers");
/** 공개 Xenova 모델 — 만료·잘못된 HF 토큰이 401을 유발할 수 있어 기본은 헤더 미전송 */
export declare function clearHubTokensForPublicFetch(): Map<string, string | undefined>;
export declare function restoreHubTokens(saved: Map<string, string | undefined>): void;
export declare function hubMirrorHosts(): readonly string[];
/**
 * Hugging Face Hub 미러 순회.
 * 전략 1: HF token이 있으면 token 사용으로 먼저 시도.
 * 전략 2: token 사용 실패 시 → token 삭제 후 public fetch로 재시도.
 * 이중 전략으로 "Unauthorized access" 오류를 회피합니다.
 */
export declare function runWithHubMirrors<T>(mod: TransformersModule, fn: () => Promise<T>): Promise<T>;
export {};
