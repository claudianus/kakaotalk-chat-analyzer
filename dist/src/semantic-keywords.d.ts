import type { KeywordRankItem } from "./keyword-rank.js";
export interface SemanticKeywordOptions {
    stopwords: ReadonlySet<string>;
    limit?: number;
    onProgress?: (current: number, total: number) => void;
}
/** 다국어(한국어 우선) 임베딩 + k-means → 클러스터 대표 키워드 */
export declare function extractSemanticKeywords(messages: string[], options: SemanticKeywordOptions): Promise<KeywordRankItem[]>;
