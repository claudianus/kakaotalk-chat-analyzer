import type { RecentPeriodInsights, RecentSnapshot } from "./types.js";
export interface BuildRecentPeriodInsightsInput {
    recentSnapshot: RecentSnapshot;
    dailySenderCounts: Map<string, Map<string, number>>;
    dailyHourly: Map<string, number[]>;
    daily: Map<string, number>;
    aliases: Map<string, string>;
    whole: {
        top3ParticipantSharePercent: number;
        participantGini: number | null;
        weekendSharePercent: number;
        nightSharePercent: number;
        avgDailyMessages: number;
        participants: number;
        totalMessages: number;
    };
}
export declare function buildRecentPeriodInsights(input: BuildRecentPeriodInsightsInput): RecentPeriodInsights;
