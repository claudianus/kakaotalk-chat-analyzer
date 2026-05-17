import { isPrimarilyKoreanMessages } from "./korean-locale.js";
import { presetForcesSentimentOff } from "./analysis-preset.js";
import { subsampleSemanticMessages, } from "./semantic-policy.js";
export { semanticSampleCap as sentimentSampleCap, semanticReservoirCap as sentimentReservoirCap, subsampleSemanticMessages as subsampleSentimentSamples, } from "./semantic-policy.js";
const MIN_SENTIMENT_MESSAGES = 48;
/** Xenova ONNX — 3-class pos/neu/neg */
export const DEFAULT_SENTIMENT_MODEL = "Xenova/distilbert-base-multilingual-cased-sentiment";
/** KLUE-RoBERTa-small 감정 (quality preset 기본 후보) */
export const KLUE_SENTIMENT_MODEL = "Xenova/klue-roberta-small-sentiment";
export function sentimentModelId(preset) {
    const env = process.env.KCA_SENTIMENT_MODEL?.trim();
    if (env)
        return env;
    const envPreset = process.env.KCA_PRESET?.trim().toLowerCase();
    if (preset === "quality" || envPreset === "quality")
        return KLUE_SENTIMENT_MODEL;
    return DEFAULT_SENTIMENT_MODEL;
}
export function shouldCollectSentimentSamples(messageCount) {
    return messageCount >= MIN_SENTIMENT_MESSAGES && process.env.KCA_NO_SENTIMENT !== "1";
}
/**
 * 감정 분석 적용 여부.
 * - 기본(auto): 한국어 비중 높은 방 + 48건 이상
 * - `KCA_NO_SENTIMENT=1` / `--no-sentiment` 로 끔
 */
export function resolveSentiment(options, prepass, sampleMessages) {
    if (process.env.KCA_NO_SENTIMENT === "1")
        return false;
    if (options?.sentiment === false)
        return false;
    if (prepass.messageCount < MIN_SENTIMENT_MESSAGES)
        return false;
    if (options?.sentiment === true)
        return true;
    if (process.env.KCA_SENTIMENT === "1")
        return true;
    if (presetForcesSentimentOff(options, prepass.messageCount))
        return false;
    if (process.env.KCA_SENTIMENT === "0")
        return false;
    if (process.env.KCA_SENTIMENT_DEFAULT === "opt-in")
        return false;
    return isPrimarilyKoreanMessages(sampleMessages);
}
export function subsampleSentimentRecords(records, cap) {
    if (records.length <= cap)
        return records;
    const indexed = records.map((r, i) => ({ r, key: `${i}\u0000${r.text}` }));
    const keys = new Set(subsampleSemanticMessages(indexed.map((x) => x.key), cap));
    return indexed.filter((x) => keys.has(x.key)).map((x) => x.r);
}
//# sourceMappingURL=sentiment-policy.js.map