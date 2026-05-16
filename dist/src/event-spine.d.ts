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
