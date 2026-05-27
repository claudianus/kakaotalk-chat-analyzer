import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { qwen35Entry } from "./llm-qwen35.js";
export { QWEN35_CATALOG, QWEN35_SERIES_LABEL, qwen35DisplayLabel } from "./llm-qwen35.js";
export function llmCacheRoot() {
    return process.env.KCA_LLM_CACHE?.trim() || join(homedir(), ".cache", "kakaotalk-chat-analyzer", "llm");
}
export function ggufPathForSize(size) {
    const custom = process.env.KCA_LLM_GGUF_PATH?.trim();
    if (custom) {
        // defense-in-depth: custom path must be inside KCA_LLM_CACHE or home dir
        const resolved = resolve(custom);
        const cacheRoot = resolve(llmCacheRoot());
        const home = resolve(homedir());
        const allowed = [cacheRoot, home].map((d) => d.endsWith(sep) ? d : d + sep);
        const ok = allowed.some((prefix) => resolved.startsWith(prefix));
        if (!ok) {
            console.warn(`[kca] KCA_LLM_GGUF_PATH (${resolved})가 허용된 경로를 벗어났습니다. 기본값을 사용합니다.`);
        }
        else {
            return resolved;
        }
    }
    const { file } = qwen35Entry(size).gguf;
    return join(llmCacheRoot(), size, file);
}
export function hfDownloadUrl(repo, file) {
    return `https://huggingface.co/${repo}/resolve/main/${file}`;
}
//# sourceMappingURL=llm-cache.js.map