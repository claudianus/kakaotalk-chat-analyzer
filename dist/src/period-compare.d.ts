import type { ActivityArcSegment, CountItem, DailyCount, PeriodCompareSlice } from "./types.js";
export interface BuildPeriodCompareInput {
    activityArc: ActivityArcSegment[];
    daily: DailyCount[];
    monthly: DailyCount[];
    headKeywords: CountItem[];
    tailKeywords: CountItem[];
}
export declare function buildPeriodCompare(input: BuildPeriodCompareInput): {
    slices: PeriodCompareSlice[];
    keywordShift: {
        head: string[];
        tail: string[];
        onlyHead: string[];
        onlyTail: string[];
    };
};
/** daily 기준 전반/후반 날짜 경계로 키워드 버킷 분리용 날짜 컷 */
export declare function periodCutDate(daily: DailyCount[]): string | null;
