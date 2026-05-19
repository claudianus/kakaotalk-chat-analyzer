export declare const TOXICITY_ONNX_ASSET = "kca-kcelectra-base-toxicity-onnx.zip";
export declare const KURE_ONNX_ASSET = "kca-kure-v1-onnx.zip";
export declare function mlBundleCacheDir(): string;
export declare function readModelsPackageVersion(): string;
export declare function mlModelsReleaseTag(): string;
/** @deprecated */ export declare const toxicityReleaseTag: typeof mlModelsReleaseTag;
export declare function toxicityReleaseAssetUrl(): string;
export declare function kureReleaseAssetUrl(): string;
/** GitHub API(최신 ml-models-v* asset) → pinned tag — v0.2.0에는 KURE zip 없음 */
export declare function listReleaseAssetUrls(assetName: string): Promise<string[]>;
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
