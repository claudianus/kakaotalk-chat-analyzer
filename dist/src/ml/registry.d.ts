export type MlTask = "sentiment" | "embedding" | "toxicity";
export interface MlModelSpec {
    task: MlTask;
    bundledId: string;
    hubFallback: string;
    hubTask: "text-classification" | "feature-extraction";
}
export declare const ML_MODEL_REGISTRY: Record<MlTask, MlModelSpec>;
export declare function isBundledModelReady(task: MlTask): boolean;
export declare function resolveSentimentBundledId(): string;
export declare function resolveEmbeddingModelId(preset: string | undefined): string;
export declare function resolveToxicityModelId(): string;
