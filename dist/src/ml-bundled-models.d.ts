/** NSMC KoELECTRA-Small (quality sentiment) */
export declare const BUNDLED_SENTIMENT_MODEL_ID = "kca-koelectra-small-v3-nsmc";
/** 이전 번들 디렉터리(호환) */
export declare const LEGACY_BUNDLED_SENTIMENT_MODEL_ID = "kca-koelectra-korean-sentiment";
/** KorSTS / semantic quality embedding */
export declare const BUNDLED_EMBED_MODEL_ID = "kca-koelectra-small-v3-embed";
/** KcELECTRA-base toxicity (optional, large) */
export declare const BUNDLED_TOXICITY_MODEL_ID = "kca-kcelectra-base-toxicity";
/** `data/ml-models/` — optional npm models 패키지 우선 */
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
