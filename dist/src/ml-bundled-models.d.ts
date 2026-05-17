/** `data/ml-models/` 하위 로컬 ONNX (transformers.js `localModelPath` 기준) */
export declare const BUNDLED_SENTIMENT_MODEL_ID = "kca-koelectra-korean-sentiment";
export declare function bundledMlModelsDir(): string;
export declare function bundledSentimentModelDir(): string;
export declare function isBundledSentimentModelReady(): boolean;
/** 번들 ONNX가 있으면 transformers `env.localModelPath` 로 쓸 루트 */
export declare function bundledMlModelsRoot(): string | undefined;
export declare function isLocalBundledSentimentModel(modelId: string): boolean;
