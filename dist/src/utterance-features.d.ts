import type { ReportAggregator } from "./aggregator.js";
import type { BuildReportOptions } from "./analyze-pool.js";
export interface UtteranceMlPassOptions {
    useSentiment: boolean;
    useSemantic: boolean;
    useToxicity: boolean;
    showProgress: boolean;
    buildOptions?: BuildReportOptions;
    messageCount: number;
}
export interface UtteranceMlPassResult {
    usedSentiment: boolean;
    usedSemantic: boolean;
    usedToxicity: boolean;
}
/** Kiwi·키워드 패스와 병렬 — sentiment·semantic·toxicity 파이프라인 워밍업 */
export declare function preloadUtteranceMl(opts: UtteranceMlPassOptions): Promise<void>;
/** 동일 subsample cap 으로 drain 1회 → 감정·독성, 시맨틱은 별도 리저보어 */
export declare function runUtteranceMlPass(agg: ReportAggregator, opts: UtteranceMlPassOptions): Promise<UtteranceMlPassResult>;
