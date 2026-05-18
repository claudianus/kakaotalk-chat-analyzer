import { isPrimarilyKoreanMessages } from "./korean-locale.js";
import { presetForcesSentimentOff } from "./analysis-preset.js";
import { BUNDLED_SENTIMENT_MODEL_ID, isBundledSentimentModelReady, resolveBundledSentimentModelId, } from "./ml-bundled-models.js";
import { HUB_KOELECTRA_NSMC } from "./ml/model-ids.js";
import { subsampleSemanticMessages, } from "./semantic-policy.js";
export { semanticSampleCap as sentimentSampleCap, semanticReservoirCap as sentimentReservoirCap, subsampleSemanticMessages as subsampleSentimentSamples, } from "./semantic-policy.js";
export { HUB_KOELECTRA_NSMC as DEFAULT_SENTIMENT_MODEL };
const MIN_SENTIMENT_MESSAGES = 48;
export function isBinarySentimentModel(modelId) {
    const id = modelId.toLowerCase();
    return (id === BUNDLED_SENTIMENT_MODEL_ID ||
        id === HUB_KOELECTRA_NSMC ||
        id.includes("koelectra"));
}
/** 이진 NSMC 계열: confidence < high 이면 neutral */
export function binarySentimentConfidenceHigh() {
    const raw = process.env.KCA_SENTIMENT_BINARY_HIGH?.trim();
    const n = Number(raw && raw.length > 0 ? raw : "0.72");
    return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0.72;
}
export function sentimentModelId(_preset, _messageCount, _options) {
    const env = process.env.KCA_SENTIMENT_MODEL?.trim();
    if (env)
        return env;
    if (isBundledSentimentModelReady())
        return resolveBundledSentimentModelId();
    return HUB_KOELECTRA_NSMC;
}
/** 번들 → Hub NSMC (구 bert Xenova 폴백 제거) */
export function sentimentModelFallbacks(preset, messageCount, options) {
    const primary = sentimentModelId(preset, messageCount, options);
    if (primary === HUB_KOELECTRA_NSMC)
        return [primary];
    return [primary, HUB_KOELECTRA_NSMC];
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