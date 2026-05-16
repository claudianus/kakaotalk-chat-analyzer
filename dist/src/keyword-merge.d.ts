import type { CountItem } from "./types.js";
import type { KeywordCounter } from "./keyword-counter.js";
/** KR-WordRank 점수 우선 + 미등록 해시태그·슬랭만 보조 */
export declare function mergeKeywordRankings(wordRank: Map<string, number>, supplement: KeywordCounter, limit: number): CountItem[];
