/**
 * ReportAggregator 헬퍼 함수 — aggregator.ts에서 추출한 순수 함수들.
 * 클래스 상태에 의존하지 않으며 독립적으로 동작합니다.
 */
import type { CountItem, ParsedDateParts, ParticipantRole, ParticipantStat, PrivacyMode } from "../types.js";
import { KeywordCounter } from "../keyword-counter.js";
export declare function round(value: number, decimals: number): number;
export declare function pad2(value: number): string;
export declare function medianSorted(sorted: number[]): number;
export declare function increment(map: Map<string, number>, key: string, amount?: number): void;
export declare function topCounts(map: Map<string, number>, limit: number): CountItem[];
export declare function buildSenderLabels(senders: string[], privacy: PrivacyMode): Map<string, string>;
export declare function normalizeToken(token: string): string;
export declare function getDomains(message: string): string[];
export declare function longestDateStreak(sortedYmd: string[]): number;
export declare function computeGini(counts: number[]): number | null;
export declare function maxSilenceGapDays(sortedYmd: string[]): number | null;
export declare function computeDensityFromSpan(first: ParsedDateParts | null, last: ParsedDateParts | null, total: number): number | null;
export declare function domainEntropyBits(domains: Map<string, number>): number | null;
export declare function computeRhythmScore(input: {
    gini: number | null;
    longestStreak: number;
    density: number | null;
}): number;
interface MutableParticipantStat {
    messages: number;
    characters: number;
    attachmentMessages: number;
    linkMessages: number;
    nightMessages: number;
    maxConsecutive: number;
}
export declare function getParticipantStat(stats: Map<string, MutableParticipantStat>, sender: string): MutableParticipantStat;
export declare function computeTop3Share(stats: Map<string, MutableParticipantStat>, total: number): number;
export declare function computeDaypartPercents(hourly: number[], total: number): {
    key: string;
    label: string;
    percent: number;
}[];
export declare function top1ShareFromCounts(keywords: {
    count: number;
}[], totalMessages: number): number | null;
export declare function typeRichnessFromKeywords(keywords: {
    label: string;
    count: number;
}[], totalMessages: number): number | null;
export declare function splitMonthlyKeywordBuckets(buckets: Map<string, KeywordCounter>): {
    headKeywords: CountItem[];
    tailKeywords: CountItem[];
};
export declare function topDailyLinkSpikes(dailyLinks: Map<string, number>): {
    date: string;
    links: number;
}[];
export type RoomEventCounts = {
    join: number;
    leave: number;
    deleted: number;
    hidden: number;
    kick: number;
    slowModeOn: number;
    slowModeOff: number;
    subManager: number;
    manager: number;
    shopSearch: number;
    photoBundle: number;
};
export declare function buildRoomEventStats(total: number, c: RoomEventCounts, shopExtra?: {
    tagExtractions: number;
    uniqueTags: number;
    untaggedNotices: number;
}): import("../types.js").RoomEventStats;
export declare function buildParticipantRoles(participants: ParticipantStat[], laughBySender: Map<string, number>, shortBySender: Map<string, number>, aliases: Map<string, string>): ParticipantRole[];
export declare function formatDayMdHighlight(ymd: string): string;
export declare function buildHighlights(input: {
    total: number;
    topAlias: string | null;
    topShare: number | null;
    busiestWeekdayLabel: string | null;
    peakHour: number | null;
    medianReplyGapMinutes: number | null;
    nightSharePercent: number;
    longestStreak: number;
    emojiMessages: number;
    messagesWithAttachments: number;
    weekendSharePercent: number;
    participantGini: number | null;
    replyGapP90Minutes: number | null;
    maxSilenceBetweenActiveDays: number | null;
    rhythmScore: number;
    burstGapUnder1mPercent: number | null;
    monologueMessagesPercent: number;
    roomJoinMessages: number;
    roomLeaveMessages: number;
    roomDeletedMessages: number;
    roomHiddenMessages: number;
    roomKickMessages: number;
    pureLaughMessages: number;
    repeatedPhraseCount: number;
    burstDays: {
        date: string;
        count: number;
    }[];
    activityArc: {
        id: string;
        label: string;
        messages: number;
        activeDays: number;
    }[];
    conversationPace: {
        label: string;
        emoji: string;
        detail: string;
    };
    roomPulse: {
        date: string;
        join: number;
        leave: number;
        hidden: number;
        kick: number;
        newSenders: number;
    }[];
    lexicalTypeRichnessPercent: number | null;
    speakerSwitchRatePer100: number;
}): string[];
export declare function inferRoomRelationship(honorific: import("../types.js").HonorificInsight): import("../types.js").RoomRelationship;
export {};
