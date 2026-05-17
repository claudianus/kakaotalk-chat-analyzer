/** 주제 lead로 쓰이면 안 되는 범용어 — 키워드 상위가 우선 */
export declare const GENERIC_TOPIC_LEADS: Set<string>;
export declare function isGenericTopicLead(term: string): boolean;
export declare function themeLeadPenalty(title: string): number;
