import type { UserWord } from "kiwi-nlp";
import type { ReportAggregator } from "./aggregator.js";
import type { SpoolKeywordPassOptions } from "./analysis-spool.js";
export declare function runKeywordPassFromSpoolPooled(spoolPath: string, agg: ReportAggregator, userWords: UserWord[], messageCount: number, opts?: SpoolKeywordPassOptions): Promise<void>;
