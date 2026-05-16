import type { HeuristicPrepassCollector } from "./export-prepass.js";
import { isPrimarilyKoreanMessages } from "./korean-locale.js";
import type { BuildReportOptions } from "./analyze-pool.js";

const MIN_SEMANTIC_MESSAGES = 48;

/** 한국어·다국어 임베딩(Hugging Face → Xenova 포팅) */
export const DEFAULT_KOREAN_SEMANTIC_MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

export function semanticEmbeddingModelId(): string {
  const env = process.env.KCA_SEMANTIC_MODEL?.trim();
  if (env) return env;
  return DEFAULT_KOREAN_SEMANTIC_MODEL;
}

export function shouldCollectSemanticSamples(messageCount: number): boolean {
  return messageCount >= MIN_SEMANTIC_MESSAGES && process.env.KCA_NO_SEMANTIC !== "1";
}

/**
 * 시맨틱 키워드 적용 여부.
 * - 기본(auto): 한국어 비중 높은 방 + 48건 이상
 * - `KCA_NO_SEMANTIC=1` / `--no-semantic-keywords` 로 끔
 */
export function resolveSemanticKeywords(
  options: BuildReportOptions | undefined,
  prepass: HeuristicPrepassCollector,
  sampleMessages: string[],
): boolean {
  if (process.env.KCA_NO_SEMANTIC === "1") return false;
  if (options?.semanticKeywords === false) return false;
  if (prepass.messageCount < MIN_SEMANTIC_MESSAGES) return false;
  if (options?.semanticKeywords === true) return true;
  if (process.env.KCA_SEMANTIC === "1") return true;
  if (process.env.KCA_SEMANTIC === "0") return false;
  return isPrimarilyKoreanMessages(sampleMessages);
}
