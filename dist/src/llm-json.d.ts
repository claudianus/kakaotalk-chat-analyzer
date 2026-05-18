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
/** 첫 `{`부터 중괄호 깊이로 닫는 `}` 위치 (문자열 내부 무시) */
export declare function findBalancedJsonEnd(text: string, start: number): number;
/** LLM 응답에서 JSON 객체 추출 (thinking·fence·서문 허용) */
export declare function extractLlmJsonObject(text: string): LlmJsonShape | null;
/** grammar.parse 1차, heuristic 2차 */
export declare function parseLlmJsonResponse(raw: string, grammar: {
    parse: (json: string) => unknown;
} | null | undefined): LlmJsonShape | null;
