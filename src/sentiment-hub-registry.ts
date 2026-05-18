import { DEFAULT_SENTIMENT_MODEL, KLUE_SENTIMENT_MODEL, LEGACY_DISTILBERT_SENTIMENT_MODEL } from "./sentiment-policy.js";

/** 익명 Hub `config.json` HEAD 가 401 인 Xenova 감정 모델 (2026-05 검증) */
export const SENTIMENT_HUB_ANONYMOUS_BLOCKLIST = [
  KLUE_SENTIMENT_MODEL,
  LEGACY_DISTILBERT_SENTIMENT_MODEL,
  "Xenova/klue-roberta-base",
  "Xenova/twitter-xlm-roberta-base-sentiment",
  "smilegate-ai/kor_unified_sentiment",
] as const;

export function isSentimentHubBlocklisted(modelId: string): boolean {
  return (SENTIMENT_HUB_ANONYMOUS_BLOCKLIST as readonly string[]).includes(modelId);
}

export function assertDefaultSentimentHubAccessible(): void {
  if (isSentimentHubBlocklisted(DEFAULT_SENTIMENT_MODEL)) {
    throw new Error(
      `DEFAULT_SENTIMENT_MODEL must not be on SENTIMENT_HUB_ANONYMOUS_BLOCKLIST: ${DEFAULT_SENTIMENT_MODEL}`,
    );
  }
}
