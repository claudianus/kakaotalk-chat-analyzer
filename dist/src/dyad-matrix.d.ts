import type { InteractionMatrix, ParticipantStat } from "./types.js";
/** 스트리밍 응답 엣지 (직전 화자 → 현재 화자) */
export declare class DyadAccumulator {
    private readonly edges;
    private totalReplies;
    addReply(fromSender: string, toSender: string): void;
    buildMatrix(participants: ParticipantStat[], aliasBySender: Map<string, string>): InteractionMatrix | null;
}
