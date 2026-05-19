export { BUNDLED_EMBED_MODEL_ID, BUNDLED_KURE_MODEL_ID, BUNDLED_SENTIMENT_MODEL_ID, BUNDLED_TOXICITY_MODEL_ID, } from "./ml-bundle-ids.js";
/** transformers `env.localModelPath` — 코어 번들(NSMC+embed)이 함께 있는 루트 우선 */
export declare function bundledMlModelsDir(): string;
export declare function bundledModelDir(modelId: string): string;
export declare function bundledSentimentModelDir(): string;
export declare function resolveBundledSentimentModelId(): string;
export declare function isBundledSentimentModelReady(): boolean;
export declare function isBundledEmbedModelReady(): boolean;
export declare function isBundledToxicityModelReady(): boolean;
export declare function isBundledKureModelReady(): boolean;
/** ONNX 외부 가중치(model.onnx_data) — 세션 cwd를 onnx/ 로 맞춤 */
export declare function hasBundledOnnxExternalData(modelId: string): boolean;
/** ORT external data는 model.onnx 기준 상대 경로 — 직렬화된 chdir */
export declare function withBundledOnnxSessionCwd<T>(modelId: string, fn: () => Promise<T>): Promise<T>;
/** 번들 ONNX가 있으면 transformers `env.localModelPath` 로 쓸 루트 */
export declare function bundledMlModelsRoot(): string | undefined;
export declare function isLocalBundledSentimentModel(modelId: string): boolean;
export declare function isLocalBundledEmbedModel(modelId: string): boolean;
export declare function isLocalBundledToxicityModel(modelId: string): boolean;
export declare function isLocalBundledKureModel(modelId: string): boolean;
