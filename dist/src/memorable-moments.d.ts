import type { DailyCount, DailySentiment, LlmInsights, MemorableMoment } from "./types.js";
export declare function getTypeIcon(type: MemorableMoment["type"]): string;
export declare function enhanceMemorableMomentsWithLlm(moments: MemorableMoment[], llmInsights: LlmInsights | undefined): MemorableMoment[];
export declare function extractMemorableMoments(params: {
    daily: DailyCount[];
    dailySentiment: DailySentiment[];
    totalMessages: number;
    firstMessageDate: string | null;
    lastMessageDate: string | null;
}): MemorableMoment[];
