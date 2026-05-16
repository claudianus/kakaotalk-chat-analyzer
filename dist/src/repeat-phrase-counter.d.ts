import type { CountItem } from "./types.js";
/** 동일 본문 반복(환영문·복붙 문구) — 상한 맵 */
export declare class RepeatPhraseCounter {
    private readonly map;
    add(text: string): void;
    top(limit: number, minCount: number): CountItem[];
    private prune;
}
