import type { ToxicityStats } from "./types.js";
import type { SentimentBatchItem } from "./sentiment-analyze.js";
export declare function preloadToxicityPipeline(): Promise<void>;
export declare function analyzeToxicityFromSamples(samples: SentimentBatchItem[], corpusMessages: number): Promise<ToxicityStats | null>;
