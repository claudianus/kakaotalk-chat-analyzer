export declare const TOXICITY_ONNX_ASSET = "kca-kcelectra-base-toxicity-onnx.zip";
export declare const KURE_ONNX_ASSET = "kca-kure-v1-onnx.zip";
export declare function mlBundleCacheDir(): string;
export declare function readModelsPackageVersion(): string;
export declare function toxicityReleaseTag(): string;
export declare function toxicityReleaseAssetUrl(): string;
export declare function kureReleaseAssetUrl(): string;
export declare function isSentimentBundleReady(): boolean;
export declare function isEmbedBundleReady(): boolean;
export declare function isToxicityBundleReady(): boolean;
export declare function isKureBundleReady(): boolean;
export declare function isCoreBundleReady(): boolean;
/** npm models 패키지 → monorepo data → user cache */
export declare function listMlModelRoots(): string[];
export declare function resolveMlModelRootFor(modelId: string): string | undefined;
/** GitHub Release 에서 독성 ONNX zip 다운로드 → cache */
export declare function ensureToxicityBundle(): Promise<boolean>;
/** GitHub Release 에서 KURE ONNX zip 다운로드 → cache */
export declare function ensureKureBundle(): Promise<boolean>;
