import type { KeywordRankItem } from "./keyword-rank.js";
import type { CountItem } from "./types.js";
import type { KeywordCounter } from "./keyword-counter.js";
/** BM25(score) + 시맨틱 supplement RRF 병합 */
export declare function mergeKeywordRankings(ranked: KeywordRankItem[], supplement: KeywordCounter, limit: number, semanticSupplementWeight?: number): CountItem[];
