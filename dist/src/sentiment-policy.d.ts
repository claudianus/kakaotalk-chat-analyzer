import type { HeuristicPrepassCollector } from "./export-prepass.js";
import type { BuildReportOptions } from "./analyze-pool.js";
export { semanticSampleCap as sentimentSampleCap, semanticReservoirCap as sentimentReservoirCap, subsampleSemanticMessages as subsampleSentimentSamples, } from "./semantic-policy.js";
/** Xenova ONNX — 3-class pos/neu/neg */
export declare const DEFAULT_SENTIMENT_MODEL = "Xenova/distilbert-base-multilingual-cased-sentiment";
/** KLUE-RoBERTa-small 감정 (quality preset 기본 후보) */
export declare const KLUE_SENTIMENT_MODEL = "Xenova/klue-roberta-small-sentiment";
export declare function sentimentModelId(preset?: string): string;
export declare function shouldCollectSentimentSamples(messageCount: number): boolean;
/**
 * 감정 분석 적용 여부.
 * - 기본(auto): 한국어 비중 높은 방 + 48건 이상
 * - `KCA_NO_SENTIMENT=1` / `--no-sentiment` 로 끔
 */
export declare function resolveSentiment(options: BuildReportOptions | undefined, prepass: HeuristicPrepassCollector, sampleMessages: string[]): boolean;
export declare function subsampleSentimentRecords<T extends {
    text: string;
}>(records: T[], cap: number): T[];
