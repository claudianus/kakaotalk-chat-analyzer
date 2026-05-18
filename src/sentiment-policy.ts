import type { HeuristicPrepassCollector } from "./export-prepass.js";
import { isPrimarilyKoreanMessages } from "./korean-locale.js";
import type { BuildReportOptions } from "./analyze-pool.js";
import { presetForcesSentimentOff, resolvePresetNameWithAuto } from "./analysis-preset.js";
import {
  BUNDLED_SENTIMENT_MODEL_ID,
  isBundledSentimentModelReady,
  resolveBundledSentimentModelId,
} from "./ml-bundled-models.js";
import {
  semanticReservoirCap,
  semanticSampleCap,
  subsampleSemanticMessages,
} from "./semantic-policy.js";

export {
  semanticSampleCap as sentimentSampleCap,
  semanticReservoirCap as sentimentReservoirCap,
  subsampleSemanticMessages as subsampleSentimentSamples,
} from "./semantic-policy.js";

const MIN_SENTIMENT_MESSAGES = 48;

/** 익명 Hub 다운로드 가능한 Xenova ONNX (nlptown 1–5 stars → pos/neu/neg) */
export const DEFAULT_SENTIMENT_MODEL = "Xenova/bert-base-multilingual-uncased-sentiment";

/** Hub 익명 401 — `KCA_SENTIMENT_MODEL` 로만 지정 */
export const LEGACY_DISTILBERT_SENTIMENT_MODEL =
  "Xenova/distilbert-base-multilingual-cased-sentiment";

/** Hub 익명 401 — `KCA_SENTIMENT_MODEL` 로만 지정 */
export const KLUE_SENTIMENT_MODEL = "Xenova/klue-roberta-small-sentiment";

export function isBinarySentimentModel(modelId: string): boolean {
  const id = modelId.toLowerCase();
  return id === BUNDLED_SENTIMENT_MODEL_ID || id.includes("koelectra");
}

/** 이진 NSMC 계열: confidence < high 이면 neutral */
export function binarySentimentConfidenceHigh(): number {
  const raw = process.env.KCA_SENTIMENT_BINARY_HIGH?.trim();
  const n = Number(raw && raw.length > 0 ? raw : "0.72");
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0.72;
}

export function sentimentModelId(
  preset?: string,
  messageCount?: number,
  options?: BuildReportOptions,
): string {
  const env = process.env.KCA_SENTIMENT_MODEL?.trim();
  if (env) return env;
  const resolved =
    preset ??
    (messageCount !== undefined && options
      ? resolvePresetNameWithAuto(options, messageCount)
      : undefined);
  const envPreset = process.env.KCA_PRESET?.trim().toLowerCase();
  const isQuality = resolved === "quality" || envPreset === "quality";
  if (isQuality && isBundledSentimentModelReady()) return resolveBundledSentimentModelId();
  return DEFAULT_SENTIMENT_MODEL;
}

/** primary 실패 시 Hub accessible Xenova 로 폴백 (primary가 이미 default면 단일) */
export function sentimentModelFallbacks(
  preset?: string,
  messageCount?: number,
  options?: BuildReportOptions,
): string[] {
  const primary = sentimentModelId(preset, messageCount, options);
  if (primary === DEFAULT_SENTIMENT_MODEL) return [primary];
  return [primary, DEFAULT_SENTIMENT_MODEL];
}

export function shouldCollectSentimentSamples(messageCount: number): boolean {
  return messageCount >= MIN_SENTIMENT_MESSAGES && process.env.KCA_NO_SENTIMENT !== "1";
}

/**
 * 감정 분석 적용 여부.
 * - 기본(auto): 한국어 비중 높은 방 + 48건 이상
 * - `KCA_NO_SENTIMENT=1` / `--no-sentiment` 로 끔
 */
export function resolveSentiment(
  options: BuildReportOptions | undefined,
  prepass: HeuristicPrepassCollector,
  sampleMessages: string[],
): boolean {
  if (process.env.KCA_NO_SENTIMENT === "1") return false;
  if (options?.sentiment === false) return false;
  if (prepass.messageCount < MIN_SENTIMENT_MESSAGES) return false;
  if (options?.sentiment === true) return true;
  if (process.env.KCA_SENTIMENT === "1") return true;
  if (presetForcesSentimentOff(options, prepass.messageCount)) return false;
  if (process.env.KCA_SENTIMENT === "0") return false;
  if (process.env.KCA_SENTIMENT_DEFAULT === "opt-in") return false;
  return isPrimarilyKoreanMessages(sampleMessages);
}

export function subsampleSentimentRecords<T extends { text: string }>(
  records: T[],
  cap: number,
): T[] {
  if (records.length <= cap) return records;
  const indexed = records.map((r, i) => ({ r, key: `${i}\u0000${r.text}` }));
  const keys = new Set(subsampleSemanticMessages(indexed.map((x) => x.key), cap));
  return indexed.filter((x) => keys.has(x.key)).map((x) => x.r);
}
