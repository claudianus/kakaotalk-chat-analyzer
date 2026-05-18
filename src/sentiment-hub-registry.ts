import { DEFAULT_SENTIMENT_MODEL } from "./sentiment-policy.js";
import { DEPRECATED_SENTIMENT_HUB_IDS } from "./ml/model-ids.js";

/** 익명 Hub `config.json` HEAD 가 401 인 구 감정 모델 */
export const SENTIMENT_HUB_ANONYMOUS_BLOCKLIST = DEPRECATED_SENTIMENT_HUB_IDS;

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
