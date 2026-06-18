import type { CountItem, DailyCount, ReportTopic, TopicTrendGranularity } from "./types.js";
export declare function isCloudNoiseLabel(label: string): boolean;
/** 워드클라우드용 — 샵검색·HTML 스크랩·영문 URL 잔여 토큰 제거 */
export declare function keywordsForCloud(keywords: CountItem[], limit?: number): {
    label: string;
    count: number;
}[];
/** HTML·영문 노이즈가 많으면 막대 차트가 가독성이 낫다 */
export declare function cloudChartMode(keywords: CountItem[]): "bar" | "cloud";
/** 활동일 < 90일·활동 월 ≤ 2 — 월별 period 카드/차트는 기간 비교로 안내 */
export declare function isShortActivitySpan(daily: DailyCount[]): boolean;
export declare function topicsForDisplay(topics: ReportTopic[], daily: DailyCount[]): ReportTopic[];
export declare function topicsThemesOnly(topics: ReportTopic[]): ReportTopic[];
export declare function chooseTopicTrendGranularity(args: {
    activeDays: number;
    spanDays: number;
}): TopicTrendGranularity;
