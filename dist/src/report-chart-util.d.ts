import type { CountItem, DailyCount, ReportTopic, TopicTrendGranularity } from "./types.js";
/** 워드클라우드용 — 샵검색·요약 boilerplate·초단어 노이즈 제거 */
export declare function keywordsForCloud(keywords: CountItem[], limit?: number): {
    label: string;
    count: number;
}[];
/** 활동일 < 90일·활동 월 ≤ 2 — 월별 period 카드/차트는 기간 비교로 안내 */
export declare function isShortActivitySpan(daily: DailyCount[]): boolean;
export declare function topicsForDisplay(topics: ReportTopic[], daily: DailyCount[]): ReportTopic[];
export declare function topicsThemesOnly(topics: ReportTopic[]): ReportTopic[];
export declare function chooseTopicTrendGranularity(args: {
    activeDays: number;
    spanDays: number;
}): TopicTrendGranularity;
