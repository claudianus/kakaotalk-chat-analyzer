import type { CountItem } from "./types.js";
import type { ReportTopic } from "./types.js";
import type { TopicMapAccumulator } from "./topic-map.js";
/** 키워드 상위(빈도·특이어) → 미니 테마 카드 */
export declare function buildKeywordSeedTopics(keywordsByFreq: CountItem[], keywordsDistinctive: CountItem[], totalMessages: number, topicMap?: TopicMapAccumulator | null): ReportTopic[];
