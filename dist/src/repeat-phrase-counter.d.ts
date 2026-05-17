import type { CountItem, RepeatedPhraseStat } from "./types.js";
/** 동일 본문 반복(환영문·복붙 문구) — 상한 맵 + 일별 피크 */
export declare class RepeatPhraseCounter {
    private readonly map;
    private readonly dailyByPhrase;
    add(text: string, dayKey?: string): void;
    peakDate(label: string): string | undefined;
    top(limit: number, minCount: number): RepeatedPhraseStat[];
    /** @deprecated use top() */
    topCounts(limit: number, minCount: number): CountItem[];
    private prune;
}
