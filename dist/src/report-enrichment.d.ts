import type { ActivityArcSegment, ConversationPace, DailyCount, DailyRoomPulse, ReportInsights } from "./types.js";
export declare function computeBurstDays(daily: DailyCount[]): DailyCount[];
export declare function computeActivityArc(daily: DailyCount[]): ActivityArcSegment[];
export declare function computeConversationPace(ins: ReportInsights): ConversationPace;
export declare function buildRoomPulse(sortedDates: string[], join: Map<string, number>, leave: Map<string, number>, hidden: Map<string, number>, kick: Map<string, number>, newSenders: Map<string, number>): DailyRoomPulse[];
