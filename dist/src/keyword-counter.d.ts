import type { CountItem } from "./types.js";
/** 키워드 맵 상한 + 전체 토큰 히트 수 추적(Top1 비중용) */
export declare class KeywordCounter {
    private readonly map;
    private totalHits;
    private maxCount;
    add(token: string): void;
    topCounts(limit: number): CountItem[];
    top1SharePercent(): number | null;
    private prune;
}
