import type { SentimentStats } from "./types.js";
import type { BuildReportOptions } from "./analyze-pool.js";
export type SentimentLabel = "positive" | "negative" | "neutral";
export interface SentimentBatchItem {
    text: string;
    sender: string;
}
type ClassificationPipeline = (input: string | string[]) => Promise<{
    label: string;
    score: number;
} | {
    label: string;
    score: number;
}[]>;
/** Kiwi 준비·키워드 패스와 병렬 워밍업 */
export declare function preloadSentimentPipeline(buildOptions?: BuildReportOptions, messageCount?: number): Promise<ClassificationPipeline>;
export declare function analyzeSentimentBatch(messages: string[], onProgress?: (done: number, total: number) => void, buildOptions?: BuildReportOptions, messageCount?: number): Promise<SentimentLabel[]>;
export declare function buildSentimentStats(samples: SentimentBatchItem[], labels: SentimentLabel[], aliasBySender: Map<string, string>): SentimentStats;
export declare function analyzeSentimentFromSamples(samples: SentimentBatchItem[], corpusMessages: number, aliasBySender: Map<string, string>, onProgress?: (done: number, total: number) => void, buildOptions?: BuildReportOptions): Promise<SentimentStats | null>;
export {};
