/** 메시지 간격(ms) 스트리밍 통계 — 소규모는 64-bin, 대용량은 exact quantile */
export declare class GapStreamStats {
    private count;
    private burstUnder1m;
    private gapOver60m;
    private readonly histogram;
    private readonly exact;
    private welfordN;
    private welfordMean;
    private welfordM2;
    add(deltaMs: number): void;
    get size(): number;
    medianMs(): number | null;
    p90Ms(): number | null;
    burstUnder1mPercent(): number | null;
    gapOver60mPercent(): number | null;
    coeffVariation(): number | null;
    private quantileMs;
}
/** 30분 이상 침묵이면 새 대화 세션으로 분리 */
export declare const SESSION_IDLE_MS: number;
export interface SessionGapSnapshot {
    sessionCount: number;
    avgMessagesPerSession: number | null;
    medianSessionMinutes: number | null;
}
export declare class SessionGapStats {
    private sessionCount;
    private currentMessages;
    private readonly messageCounts;
    private readonly durationMs;
    private sessionStartMs;
    private lastMs;
    addMessage(ms: number): void;
    finalize(): SessionGapSnapshot;
    private openSession;
    private closeSession;
}
