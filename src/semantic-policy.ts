import type { HeuristicPrepassCollector } from "./export-prepass.js";
import { isPrimarilyKoreanMessages } from "./korean-locale.js";
import type { BuildReportOptions } from "./analyze-pool.js";

const MIN_SEMANTIC_MESSAGES = 48;

/** 한국어 MTEB 경량 1위급 — intfloat/multilingual-e5-small (Xenova ONNX) */
export const DEFAULT_KOREAN_SEMANTIC_MODEL = "Xenova/multilingual-e5-small";

/** 이전 기본값(롤백: `KCA_SEMANTIC_MODEL` 로 지정) */
export const LEGACY_SEMANTIC_MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

const E5_QUERY_PREFIX = "query: ";

export function semanticEmbeddingModelId(): string {
  const env = process.env.KCA_SEMANTIC_MODEL?.trim();
  if (env) return env;
  return DEFAULT_KOREAN_SEMANTIC_MODEL;
}

/** E5 계열은 대칭 클러스터링에도 MS 권장 `query:` 접두사 사용 */
export function needsE5QueryPrefix(modelId: string): boolean {
  const id = modelId.toLowerCase();
  if (id.includes("minilm") || id.includes("paraphrase-multilingual")) return false;
  return id.includes("e5") || id.includes("koe5");
}

export function formatTextForEmbedding(text: string, modelId?: string): string {
  const id = modelId ?? semanticEmbeddingModelId();
  if (!needsE5QueryPrefix(id)) return text;
  const trimmed = text.trimStart();
  if (trimmed.startsWith("query:") || trimmed.startsWith("passage:")) return text;
  return `${E5_QUERY_PREFIX}${text}`;
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
