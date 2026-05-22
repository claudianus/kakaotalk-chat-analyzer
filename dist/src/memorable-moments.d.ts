import type { DailyCount, DailySentiment, MemorableMoment } from "./types.js";
export declare function getTypeIcon(type: MemorableMoment["type"]): string;
export declare function extractMemorableMoments(params: {
    daily: DailyCount[];
    dailySentiment: DailySentiment[];
    totalMessages: number;
    firstMessageDate: string | null;
    lastMessageDate: string | null;
}): MemorableMoment[];
