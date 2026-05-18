import type { BuildReportOptions } from "../../analyze-pool.js";
export interface PreloadUtteranceMlTasksOptions {
    sentiment: boolean;
    semantic: boolean;
    toxicity: boolean;
    buildOptions?: BuildReportOptions;
    messageCount: number;
}
/** transformers 파이프라인 병렬 워밍업(실패는 stderr 만) */
export declare function preloadUtteranceMlTasks(opts: PreloadUtteranceMlTasksOptions): Promise<void>;
