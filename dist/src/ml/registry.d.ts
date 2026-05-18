export type MlTask = "sentiment" | "embedding" | "toxicity";
export interface MlModelSpec {
    task: MlTask;
    bundledId: string;
    hubFallback: string;
    hubTask: "text-classification" | "feature-extraction";
}
export declare const ML_MODEL_REGISTRY: Record<MlTask, MlModelSpec>;
export declare function isBundledModelReady(task: MlTask): boolean;
/** quality preset sentiment: 번들 id (레거시 디렉터리 포함) */
export declare function resolveSentimentBundledId(): string;
/** quality preset embedding: 번들 KoELECTRA 또는 E5 Hub */
export declare function resolveEmbeddingModelId(preset: string | undefined): string;
export declare function resolveToxicityModelId(): string;
