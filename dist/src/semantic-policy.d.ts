import type { HeuristicPrepassCollector } from "./export-prepass.js";
import type { BuildReportOptions } from "./analyze-pool.js";
/** 한국어·다국어 임베딩(Hugging Face → Xenova 포팅) */
export declare const DEFAULT_KOREAN_SEMANTIC_MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
export declare function semanticEmbeddingModelId(): string;
export declare function shouldCollectSemanticSamples(messageCount: number): boolean;
/**
 * 시맨틱 키워드 적용 여부.
 * - 기본(auto): 한국어 비중 높은 방 + 48건 이상
 * - `KCA_NO_SEMANTIC=1` / `--no-semantic-keywords` 로 끔
 */
export declare function resolveSemanticKeywords(options: BuildReportOptions | undefined, prepass: HeuristicPrepassCollector, sampleMessages: string[]): boolean;
