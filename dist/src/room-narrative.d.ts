import type { ConversationPace, ParticipantPersona, ReportInsights, ReportTimelineEvent, ReportTopic } from "./types.js";
export interface BuildRoomNarrativeInput {
    chatRoomName: string;
    totalMessages: number;
    participants: number;
    pace: ConversationPace;
    insights: ReportInsights;
    topics: ReportTopic[];
    personas: ParticipantPersona[];
    events: ReportTimelineEvent[];
    topDyadLabel: string | null;
}
export interface RoomNarrative {
    ogSummary: string;
    paragraphs: string[];
}
export declare function buildRoomNarrative(input: BuildRoomNarrativeInput): RoomNarrative;
