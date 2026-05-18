import { type Qwen35Size } from "./llm-qwen35.js";
export { QWEN35_CATALOG, QWEN35_SERIES_LABEL, qwen35DisplayLabel } from "./llm-qwen35.js";
export declare function llmCacheRoot(): string;
export declare function ggufPathForSize(size: Qwen35Size): string;
export declare function hfDownloadUrl(repo: string, file: string): string;
