/** Qwen3.5 small dense 라인업 (공식 4종) */
export type Qwen35Size = "0.8B" | "2B" | "4B" | "9B";
export declare const QWEN35_SERIES_LABEL = "Qwen3.5";
export interface Qwen35GgufSpec {
    repo: string;
    file: string;
    hubId: string;
}
export interface Qwen35ModelEntry {
    size: Qwen35Size;
    minHeadroomGb: number;
    timeoutMs: number;
    gguf: Qwen35GgufSpec;
    ollamaTag: string;
}
/**
 * 큰 모델 우선 (greedy max). unsloth GGUF — 공식 `Qwen/Qwen3.5-*-Instruct-GGUF` 가 비면 동일 계열.
 */
export declare const QWEN35_CATALOG: readonly Qwen35ModelEntry[];
export declare function qwen35Entry(size: Qwen35Size): Qwen35ModelEntry;
export declare function qwen35DisplayLabel(size: Qwen35Size): string;
/** CLI·env 파싱 (`0.8b`, `qwen3.5-4b`, legacy `8b`→9B) */
export declare function parseQwen35Size(raw: string): Qwen35Size | undefined;
/** 9B→4B→2B→0.8B — 없으면 undefined */
export declare function downgradeQwen35Size(size: Qwen35Size): Qwen35Size | undefined;
export declare const MIN_GGUF_BYTES: Record<Qwen35Size, number>;
