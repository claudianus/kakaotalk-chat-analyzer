import type { ReportTopic } from "./types.js";
export interface TopicLaneInput {
    graph: ReportTopic[];
    keyword: ReportTopic[];
    semantic: ReportTopic[];
}
/** graph·keyword·semantic 3레인 RRF 병합 */
export declare function mergeTopicLanes(lanes: TopicLaneInput, totalMessages: number): ReportTopic[];
export interface LlmTopicProposal {
    title: string;
    terms?: string[];
    keywordEvidence?: string[];
}
/** LLM 제안 주제 — keywordEvidence가 키워드 집합에 있을 때만 추가 */
export declare function mergeTopicProposals(topics: ReportTopic[], proposals: LlmTopicProposal[] | undefined, keywords: {
    label: string;
    count: number;
}[], totalMessages: number): ReportTopic[];
