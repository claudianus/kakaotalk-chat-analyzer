import type { HeuristicPrepassCollector } from "./export-prepass.js";
import type { BuildReportOptions } from "./analyze-pool.js";
export declare function semanticSampleCap(messageCount: number): number;
/** 스트리밍·사전 집계 없을 때 리저보어 상한 */
export declare function semanticReservoirCap(estimatedMessages?: number): number;
/** 리저보어·임베딩 상한 초과 시 무작위 subsample */
export declare function subsampleSemanticMessages(messages: string[], cap: number): string[];
/** 한국어 MTEB 경량 1위급 — intfloat/multilingual-e5-small (Xenova ONNX) */
export declare const DEFAULT_KOREAN_SEMANTIC_MODEL = "Xenova/multilingual-e5-small";
/** 이전 기본값(롤백: `KCA_SEMANTIC_MODEL` 로 지정) */
export declare const LEGACY_SEMANTIC_MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
export declare function semanticEmbeddingModelId(): string;
/** E5 계열은 대칭 클러스터링에도 MS 권장 `query:` 접두사 사용 */
export declare function needsE5QueryPrefix(modelId: string): boolean;
export declare function formatTextForEmbedding(text: string, modelId?: string): string;
export declare function shouldCollectSemanticSamples(messageCount: number): boolean;
/**
 * 시맨틱 키워드 적용 여부.
 * - 기본(auto): 한국어 비중 높은 방 + 48건 이상
 * - `KCA_NO_SEMANTIC=1` / `--no-semantic-keywords` 로 끔
 */
export declare function resolveSemanticKeywords(options: BuildReportOptions | undefined, prepass: HeuristicPrepassCollector, sampleMessages: string[]): boolean;
