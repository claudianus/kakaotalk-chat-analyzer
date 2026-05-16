import type { Kiwi } from "kiwi-nlp";
/** 형태소 분석기 준비(실패 시 null → 휴리스틱 폴백) */
export declare function initKiwiRuntime(): Promise<Kiwi | null>;
export declare function getKiwiRuntime(): Kiwi | null;
export declare function isKiwiReady(): boolean;
export declare function kiwiKeywordTokens(text: string): string[];
/** 캐시 디렉터리(테스트·진단용) */
export declare function kiwiCacheDir(): string;
export declare function resetKiwiRuntimeForTests(): void;
