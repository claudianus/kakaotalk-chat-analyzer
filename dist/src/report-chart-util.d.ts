import type { DailyCount, ReportTopic } from "./types.js";
/** 활동일 < 90일·활동 월 ≤ 2 — 월별 period 카드/차트는 기간 비교로 안내 */
export declare function isShortActivitySpan(daily: DailyCount[]): boolean;
export declare function topicsForDisplay(topics: ReportTopic[], daily: DailyCount[]): ReportTopic[];
export declare function topicsThemesOnly(topics: ReportTopic[]): ReportTopic[];
