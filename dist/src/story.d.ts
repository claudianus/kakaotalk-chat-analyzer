import type { ActivityArcSegment, ConversationPace, ConversationTone, DailyCount, DailyRoomPulse, ParticipantStat, ReportInsights, ReportStory, ReportTopic } from "./types.js";
export interface BuildStoryInput {
    chatRoomName: string;
    totalMessages: number;
    activeDays: number;
    firstMessage: string | null;
    lastMessage: string | null;
    longestStreak: number;
    peakHour: number | null;
    busiestWeekdayLabel: string | null;
    nightSharePercent: number;
    emojiMessages: number;
    participants: ParticipantStat[];
    daily: DailyCount[];
    dailySenderCounts: Map<string, Map<string, number>>;
    senderAliases: Map<string, string>;
    insights: ReportInsights;
    laughMessages: number;
    shortMessages: number;
    laughBySender: Map<string, number>;
    shortBySender: Map<string, number>;
    burstDays: DailyCount[];
    activityArc: ActivityArcSegment[];
    conversationPace: ConversationPace;
    roomPulse: DailyRoomPulse[];
    topics?: ReportTopic[];
}
export declare function buildReportStory(input: BuildStoryInput): ReportStory;
export interface PersonaCounters {
    laughBySender: Map<string, number>;
    shortBySender: Map<string, number>;
}
export declare function buildTone(total: number, laugh: number, short: number, emoji: number): ConversationTone;
