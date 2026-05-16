export interface KeywordRankItem {
    label: string;
    /** TF-IDF 상대 점수 */
    score: number;
    /** 해당 표현이 등장한 메시지 수 */
    messageHits: number;
}
export interface KeywordExtractOptions {
    stopwords?: ReadonlySet<string>;
    limit?: number;
    minDocFreq?: number;
}
/** 메시지 수에 따른 최소 문서 빈도 */
export declare function adaptiveMinCount(messageCount: number, koreanPrimary?: boolean): number;
