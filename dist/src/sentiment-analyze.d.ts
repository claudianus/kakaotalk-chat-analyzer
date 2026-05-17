import type { SentimentStats } from "./types.js";
import type { BuildReportOptions } from "./analyze-pool.js";
export type SentimentLabel = "positive" | "negative" | "neutral";
export interface SentimentBatchItem {
    text: string;
    sender: string;
}
export declare function analyzeSentimentBatch(messages: string[], onProgress?: (done: number, total: number) => void, buildOptions?: BuildReportOptions): Promise<SentimentLabel[]>;
export declare function buildSentimentStats(samples: SentimentBatchItem[], labels: SentimentLabel[], aliasBySender: Map<string, string>): SentimentStats;
export declare function analyzeSentimentFromSamples(samples: SentimentBatchItem[], corpusMessages: number, aliasBySender: Map<string, string>, onProgress?: (done: number, total: number) => void, buildOptions?: BuildReportOptions): Promise<SentimentStats | null>;
