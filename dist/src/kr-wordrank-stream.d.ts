export type SubwordPos = "L" | "R";
export type SubwordToken = readonly [word: string, pos: SubwordPos];
export interface KrWordRankOptions {
    minCount?: number;
    maxLength?: number;
    beta?: number;
    maxIter?: number;
    numRset?: number;
    converge?: number;
}
export interface KrWordRankExtractOptions {
    stopwords?: ReadonlySet<string>;
    limit?: number;
}
export interface KeywordRankItem {
    label: string;
    /** HITS 점수 (상대 중요도) */
    score: number;
    /** 해당 단어가 등장한 메시지 수(문서 빈도) */
    messageHits: number;
}
/** 메시지 스트림으로 학습 → HITS → L-부분 키워드 */
export declare class KrWordRankStream {
    private minCount;
    private readonly maxLength;
    private readonly beta;
    private readonly maxIter;
    private readonly numRset;
    private readonly converge;
    private readonly counter;
    private readonly edgeCounts;
    /** 공백 단위 어절이 포함된 메시지 수 */
    private readonly wordDocFreq;
    private documents;
    constructor(options?: KrWordRankOptions);
    addDocument(raw: string): void;
    extractKeywords(options?: KrWordRankExtractOptions): Map<string, number>;
    extractKeywordItems(options?: KrWordRankExtractOptions): KeywordRankItem[];
    private scanToken;
    private bumpCounter;
    private pruneCounter;
    private bumpEdge;
    private buildVocabulary;
    private buildGraph;
}
/** 메시지 수에 따른 min_count (소규모 방 완화) */
export declare function adaptiveMinCount(messageCount: number): number;
