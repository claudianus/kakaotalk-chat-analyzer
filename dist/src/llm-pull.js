import { mkdir, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { TIER_GGUF, ggufPathForTier, hfDownloadUrl, llmCacheRoot } from "./llm-cache.js";
export function parsePullTier(raw) {
    const t = raw.trim().toLowerCase().replace(/^qwen3\.5-/, "");
    if (t === "0.8b" || t === "2b" || t === "4b")
        return t;
    throw new Error(`지원 tier: 0.8b | 2b | 4b (또는 qwen3.5-2b 형식). 받은 값: "${raw}"`);
}
export async function pullLlmGguf(tier) {
    const dest = ggufPathForTier(tier);
    try {
        const st = await stat(dest);
        if (st.size > 1_000_000) {
            process.stderr.write(`[kca] 이미 있음: ${dest} (${(st.size / 1024 / 1024).toFixed(1)} MiB)\n`);
            return dest;
        }
    }
    catch {
        /* download */
    }
    const { repo, file } = TIER_GGUF[tier];
    const url = hfDownloadUrl(repo, file);
    await mkdir(join(llmCacheRoot(), tier), { recursive: true });
    process.stderr.write(`[kca] 다운로드: ${url}\n→ ${dest}\n`);
    const headers = {};
    const token = process.env.HF_TOKEN || process.env.HUGGING_FACE_HUB_TOKEN;
    if (token)
        headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url, { headers, redirect: "follow" });
    if (!res.ok || !res.body) {
        throw new Error(`GGUF 다운로드 실패 (${res.status}): ${url}`);
    }
    await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
    const st = await stat(dest);
    process.stderr.write(`[kca] 완료 ${(st.size / 1024 / 1024).toFixed(1)} MiB\n`);
    return dest;
}
//# sourceMappingURL=llm-pull.js.map