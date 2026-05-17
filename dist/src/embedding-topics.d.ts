import type { KeywordRankItem } from "./keyword-rank.js";
import type { ReportTopic } from "./types.js";
/** 시맨틱 클러스터 대표어 → semantic 레인 theme */
export declare function semanticItemsToTopics(items: KeywordRankItem[], totalMessages: number, opts?: {
    max?: number;
}): ReportTopic[];
/** @deprecated topic-merge semantic 레인 사용 */
export declare function mergeEmbeddingThemes(graphTopics: ReportTopic[], semanticItems: KeywordRankItem[], totalMessages: number): ReportTopic[];
