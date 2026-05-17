import { adaptiveMinCount, type KeywordExtractOptions, type KeywordRankItem } from "./keyword-rank.js";
export { adaptiveMinCount, type KeywordExtractOptions, type KeywordRankItem };
/** Okapi BM25 (집계 tf·df·코퍼스 평균 길이) */
export declare function bm25Score(tf: number, df: number, corpusMessages: number, avgDl: number): number;
export type KeywordTokenizeFn = (raw: string) => string[];
/** 메시지 스트림 → BM25 어절·2-gram 키워드 */
export declare class StreamingTfidfKeywords {
    private readonly tokenize;
    private documents;
    private readonly termFreq;
    private readonly docFreq;
    private readonly bigramTf;
    private readonly bigramDf;
    private totalTokenHits;
    constructor(tokenize?: KeywordTokenizeFn);
    addDocument(raw: string): void;
    /** Kiwi 토큰을 한 번만 계산했을 때 */
    addDocumentTokens(tokens: string[]): void;
    /** minDf 통과 전체 후보 — dual-lane merge 입력 */
    collectKeywordCandidates(options?: KeywordExtractOptions): KeywordRankItem[];
    extractKeywordItems(options?: KeywordExtractOptions): KeywordRankItem[];
    private prunePair;
}
