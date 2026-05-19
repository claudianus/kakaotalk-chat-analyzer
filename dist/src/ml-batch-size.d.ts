/** 임베딩·감정 ONNX 배치 — RAM·GPU·env override */
export declare function resolveEmbedBatchSize(semanticModelId?: string): number;
export declare function resolveSentimentBatchSize(): number;
/** 프로파일·GPU 반영 배치 (비동기 GPU 프로브) */
export declare function resolveEmbedBatchSizeAsync(semanticModelId?: string): Promise<number>;
