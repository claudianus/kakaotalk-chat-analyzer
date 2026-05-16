import type { KeywordRankItem } from "./kr-wordrank-stream.js";
import type { CountItem } from "./types.js";
import type { KeywordCounter } from "./keyword-counter.js";
/** KR-WordRank 점수 순 + 실제 메시지 등장 횟수(count) */
export declare function mergeKeywordRankings(ranked: KeywordRankItem[], supplement: KeywordCounter, limit: number): CountItem[];
