export { BUNDLED_EMBED_MODEL_ID, BUNDLED_SENTIMENT_MODEL_ID, BUNDLED_TOXICITY_MODEL_ID, } from "./ml-bundle-ids.js";
/** transformers `env.localModelPath` — 해당 모델이 있는 첫 루트 */
export declare function bundledMlModelsDir(): string;
export declare function bundledModelDir(modelId: string): string;
export declare function bundledSentimentModelDir(): string;
export declare function resolveBundledSentimentModelId(): string;
export declare function isBundledSentimentModelReady(): boolean;
export declare function isBundledEmbedModelReady(): boolean;
export declare function isBundledToxicityModelReady(): boolean;
/** 번들 ONNX가 있으면 transformers `env.localModelPath` 로 쓸 루트 */
export declare function bundledMlModelsRoot(): string | undefined;
export declare function isLocalBundledSentimentModel(modelId: string): boolean;
export declare function isLocalBundledEmbedModel(modelId: string): boolean;
export declare function isLocalBundledToxicityModel(modelId: string): boolean;
