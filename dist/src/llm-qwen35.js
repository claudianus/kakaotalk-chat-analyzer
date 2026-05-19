export const QWEN35_SERIES_LABEL = "Qwen3.5";
/**
 * 큰 모델 우선 (greedy max). unsloth GGUF — 공식 `Qwen/Qwen3.5-*-Instruct-GGUF` 가 비면 동일 계열.
 */
export const QWEN35_CATALOG = [
    {
        size: "9B",
        minHeadroomGb: 12,
        timeoutMs: 90_000,
        gguf: {
            repo: "unsloth/Qwen3.5-9B-GGUF",
            file: "Qwen3.5-9B-Q4_K_M.gguf",
            hubId: "unsloth/Qwen3.5-9B-GGUF",
        },
        ollamaTag: "qwen3.5:9b",
    },
    {
        size: "4B",
        minHeadroomGb: 8,
        timeoutMs: 60_000,
        gguf: {
            repo: "unsloth/Qwen3.5-4B-GGUF",
            file: "Qwen3.5-4B-Q4_K_M.gguf",
            hubId: "unsloth/Qwen3.5-4B-GGUF",
        },
        ollamaTag: "qwen3.5:4b",
    },
    {
        size: "2B",
        minHeadroomGb: 5,
        timeoutMs: 45_000,
        gguf: {
            repo: "unsloth/Qwen3.5-2B-GGUF",
            file: "Qwen3.5-2B-Q4_K_M.gguf",
            hubId: "unsloth/Qwen3.5-2B-GGUF",
        },
        ollamaTag: "qwen3.5:2b",
    },
    {
        size: "0.8B",
        minHeadroomGb: 3,
        timeoutMs: 45_000,
        gguf: {
            repo: "unsloth/Qwen3.5-0.8B-GGUF",
            file: "Qwen3.5-0.8B-Q4_K_M.gguf",
            hubId: "unsloth/Qwen3.5-0.8B-GGUF",
        },
        ollamaTag: "qwen3.5:0.8b",
    },
];
const BY_SIZE = new Map(QWEN35_CATALOG.map((e) => [e.size, e]));
export function qwen35Entry(size) {
    const e = BY_SIZE.get(size);
    if (!e)
        throw new Error(`unknown Qwen35Size: ${size}`);
    return e;
}
export function qwen35DisplayLabel(size) {
    return `${QWEN35_SERIES_LABEL}-${size}`;
}
let legacy8bWarned = false;
/** CLI·env 파싱 (`0.8b`, `qwen3.5-4b`, legacy `8b`→9B) */
export function parseQwen35Size(raw) {
    let t = raw.trim().toLowerCase().replace(/^qwen3\.5-/, "");
    if (t === "8b" || t === "8") {
        if (!legacy8bWarned) {
            legacy8bWarned = true;
            process.stderr.write("[kca] KCA_LLM_MODEL=8b 는 Qwen3.5에 없습니다 → 9B 로 사용합니다.\n");
        }
        return "9B";
    }
    if (t === "0.8b" || t === "0.8")
        return "0.8B";
    if (t === "2b" || t === "2")
        return "2B";
    if (t === "4b" || t === "4")
        return "4B";
    if (t === "9b" || t === "9")
        return "9B";
    const upper = raw.trim().toUpperCase();
    if (upper === "0.8B" || upper === "2B" || upper === "4B" || upper === "9B") {
        return upper;
    }
    return undefined;
}
const SIZE_LADDER_DESC = ["9B", "4B", "2B", "0.8B"];
/** 9B→4B→2B→0.8B — 없으면 undefined */
export function downgradeQwen35Size(size) {
    const i = SIZE_LADDER_DESC.indexOf(size);
    if (i < 0 || i >= SIZE_LADDER_DESC.length - 1)
        return undefined;
    return SIZE_LADDER_DESC[i + 1];
}
export const MIN_GGUF_BYTES = {
    "0.8B": 400_000_000,
    "2B": 1_200_000_000,
    "4B": 2_400_000_000,
    "9B": 5_000_000_000,
};
//# sourceMappingURL=llm-qwen35.js.map