import type { KeywordRankItem } from "./keyword-rank.js";
import type { ReportTopic } from "./types.js";
/** 시맨틱 클러스터 대표어 → theme 주제 (KCA_EMBEDDING_TOPICS=1) */
export declare function semanticItemsToTopics(items: KeywordRankItem[], totalMessages: number): ReportTopic[];
export declare function mergeEmbeddingThemes(graphTopics: ReportTopic[], semanticItems: KeywordRankItem[], totalMessages: number): ReportTopic[];
