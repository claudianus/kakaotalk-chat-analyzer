export interface LlmJsonShape {
    topicTitles?: {
        i: number;
        title: string;
    }[];
    topicProposals?: {
        title: string;
        terms?: string[];
        keywordEvidence?: string[];
    }[];
    paragraphs?: string[];
    insightBullets?: string[];
    shopSearchSummary?: string;
    dyadInsight?: string;
}
/** LLM 응답에서 JSON 객체 추출 (thinking·fence·서문 허용) */
export declare function extractLlmJsonObject(text: string): LlmJsonShape | null;
