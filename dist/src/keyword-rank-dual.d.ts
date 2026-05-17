import type { KeywordRankItem } from "./keyword-rank.js";
import type { CountItem } from "./types.js";
import type { KeywordCounter } from "./keyword-counter.js";
export interface DualLaneKeywordMerge {
    /** BM25+빈도 합성점수 순 (특이어 뷰) */
    distinctive: CountItem[];
    /** 메시지 df 순 (빈도 뷰·기본 표시) */
    byFrequency: CountItem[];
}
/** 코퍼스 규모별 dual-lane 상한 */
export declare function keywordLaneCaps(messageCount: number, outputLimit: number): {
    freqCap: number;
    bm25Cap: number;
    outputLimit: number;
};
/**
 * 빈도 레인(메시지 df) + BM25 레인(특이어) 합집합.
 * distinctive = 합성점수 순, byFrequency = 메시지 수 순.
 */
export declare function mergeDualLaneKeywords(candidates: KeywordRankItem[], supplement: KeywordCounter, messageCount: number, outputLimit: number, semanticSupplementWeight?: number): DualLaneKeywordMerge;
