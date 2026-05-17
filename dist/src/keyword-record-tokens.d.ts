import type { ChatRecord } from "./types.js";
export interface KeywordTokenResult {
    tokens: string[];
    monthKey: string;
}
/** consumeKeywords와 동일 필터·토큰화 (worker pool·단일 스레드 공용) */
export declare function keywordTokensForRecord(record: ChatRecord): KeywordTokenResult | null;
