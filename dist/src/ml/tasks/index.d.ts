import type { BuildReportOptions } from "../../analyze-pool.js";
export interface PreloadUtteranceMlTasksOptions {
    sentiment: boolean;
    semantic: boolean;
    toxicity: boolean;
    buildOptions?: BuildReportOptions;
    messageCount: number;
}
/** transformers 파이프라인 워밍업 — 저RAM(<12GB headroom)은 순차, 아니면 병렬 */
export declare function preloadUtteranceMlTasks(opts: PreloadUtteranceMlTasksOptions): Promise<void>;
