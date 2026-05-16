import type { KeywordRankItem } from "./keyword-rank.js";
import type { CountItem } from "./types.js";
import type { KeywordCounter } from "./keyword-counter.js";
/** TF-IDF 점수 순 + 메시지 등장 횟수(count) */
export declare function mergeKeywordRankings(ranked: KeywordRankItem[], supplement: KeywordCounter, limit: number): CountItem[];
