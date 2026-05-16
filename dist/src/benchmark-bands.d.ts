import type { BenchmarkMetric } from "./types.js";
export declare function buildBenchmarkBandsFromValues(input: {
    participantGini: number | null;
    nightSharePercent: number;
    speakerSwitchRatePer100: number;
    rhythmScore: number;
    weekendSharePercent: number;
}): BenchmarkMetric[];
