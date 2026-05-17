import type { HeuristicPrepassCollector } from "./export-prepass.js";
import type { BuildReportOptions } from "./analyze-pool.js";
export { semanticSampleCap as sentimentSampleCap, semanticReservoirCap as sentimentReservoirCap, subsampleSemanticMessages as subsampleSentimentSamples, } from "./semantic-policy.js";
/** 익명 Hub 다운로드 가능한 Xenova ONNX (nlptown 1–5 stars → pos/neu/neg) */
export declare const DEFAULT_SENTIMENT_MODEL = "Xenova/bert-base-multilingual-uncased-sentiment";
/** Hub 익명 401 — `KCA_SENTIMENT_MODEL` 로만 지정 */
export declare const LEGACY_DISTILBERT_SENTIMENT_MODEL = "Xenova/distilbert-base-multilingual-cased-sentiment";
/** Hub 익명 401 — `KCA_SENTIMENT_MODEL` 로만 지정 */
export declare const KLUE_SENTIMENT_MODEL = "Xenova/klue-roberta-small-sentiment";
export declare function isBinarySentimentModel(modelId: string): boolean;
/** 이진 NSMC 계열: confidence < high 이면 neutral */
export declare function binarySentimentConfidenceHigh(): number;
export declare function sentimentModelId(preset?: string, messageCount?: number, options?: BuildReportOptions): string;
/** primary 실패 시 Hub accessible Xenova 로 폴백 (primary가 이미 default면 단일) */
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
