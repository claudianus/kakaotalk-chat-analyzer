import type { HeuristicPrepassCollector } from "./export-prepass.js";
import type { BuildReportOptions } from "./analyze-pool.js";
import { HUB_KOELECTRA_NSMC } from "./ml/model-ids.js";
export { semanticSampleCap as sentimentSampleCap, semanticReservoirCap as sentimentReservoirCap, subsampleSemanticMessages as subsampleSentimentSamples, } from "./semantic-policy.js";
export { HUB_KOELECTRA_NSMC as DEFAULT_SENTIMENT_MODEL };
export declare function isBinarySentimentModel(modelId: string): boolean;
/** 이진 NSMC 계열: confidence < high 이면 neutral */
export declare function binarySentimentConfidenceHigh(): number;
export declare function sentimentModelId(_preset?: string, _messageCount?: number, _options?: BuildReportOptions): string;
/** 번들 → Hub NSMC (구 bert Xenova 폴백 제거) */
export declare function sentimentModelFallbacks(preset?: string, messageCount?: number, options?: BuildReportOptions): string[];
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
