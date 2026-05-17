import type { ReportTopic } from "./types.js";
export declare function normalizeTopicTerm(raw: string): string;
export declare function normalizeTopicTerms(terms: string[]): string[];
/** 제목 · 구분 — 순서 무관 동일 키 */
export declare function topicPairKey(title: string): string;
/** 테마 유사도 0–1 (병합·시드 스킵용) */
export declare function topicSimilarity(a: ReportTopic, b: ReportTopic): number;
export declare function normalizedTermsKey(terms: string[]): string;
