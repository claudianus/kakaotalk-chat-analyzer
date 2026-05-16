import { adaptiveMinCount, type KeywordExtractOptions, type KeywordRankItem } from "./keyword-rank.js";
export { adaptiveMinCount, type KeywordExtractOptions, type KeywordRankItem };
export type KeywordTokenizeFn = (raw: string) => string[];
/** 메시지 스트림 → TF-IDF 어절·2-gram 키워드 */
export declare class StreamingTfidfKeywords {
    private readonly tokenize;
    private documents;
    private readonly termFreq;
    private readonly docFreq;
    private readonly bigramTf;
    private readonly bigramDf;
    constructor(tokenize?: KeywordTokenizeFn);
    addDocument(raw: string): void;
    extractKeywordItems(options?: KeywordExtractOptions): KeywordRankItem[];
    private prunePair;
}
