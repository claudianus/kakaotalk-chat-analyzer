import type { KeywordRankItem } from "./keyword-rank.js";
import type { BuildReportOptions } from "./analyze-pool.js";
type FeaturePipeline = (input: string | string[], options?: {
    pooling?: string;
    normalize?: boolean;
}) => Promise<{
    data: Float32Array | number[];
    dims: number[];
}>;
/** Kiwi 준비·키워드 패스와 병렬 워밍업 */
export declare function preloadSemanticPipeline(buildOptions?: BuildReportOptions, messageCount?: number): Promise<FeaturePipeline>;
/** LLM 직전 ONNX 해제 */
export declare function disposeSemanticPipeline(): Promise<void>;
export interface SemanticKeywordOptions {
    stopwords: ReadonlySet<string>;
    /** 코퍼스 전체 메시지 수(임베딩 샘플 상한·리저보어 cap 정렬용) */
    corpusMessages?: number;
    limit?: number;
    minClusterCoherence?: number;
    onProgress?: (current: number, total: number) => void;
    buildOptions?: BuildReportOptions;
}
/** 다국어(한국어 우선) 임베딩 + k-means → 클러스터 대표 키워드 */
export declare function extractSemanticKeywords(messages: string[], options: SemanticKeywordOptions): Promise<KeywordRankItem[]>;
export {};
