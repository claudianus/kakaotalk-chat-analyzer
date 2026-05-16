import type { DailyCount, DailyRoomPulse, ReportTimelineEvent, RepeatedPhraseStat } from "./types.js";
export interface BuildEventSpineInput {
    burstDays: DailyCount[];
    daily: DailyCount[];
    roomPulse: DailyRoomPulse[];
    repeatedPhrases: RepeatedPhraseStat[];
    maxSilenceBetweenActiveDays: number | null;
    dailyLinkSpikes: {
        date: string;
        links: number;
    }[];
    dailyPlanSignals: {
        date: string;
        hits: number;
    }[];
}
export declare function buildEventSpine(input: BuildEventSpineInput): ReportTimelineEvent[];
/** 타임라인 힌트용 활동 범위 */
export declare function timelineActivityRange(daily: DailyCount[]): {
    first: string;
    last: string;
} | null;
