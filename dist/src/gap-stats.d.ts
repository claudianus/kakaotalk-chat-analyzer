/** 메시지 간격(ms) 스트리밍 통계 — 전체 배열·정렬 없이 백분위·CV 근사 */
export declare class GapStreamStats {
    private count;
    private burstUnder1m;
    private gapOver60m;
    private readonly histogram;
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
