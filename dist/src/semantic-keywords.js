import { homedir } from "node:os";
import { join } from "node:path";
import { kMeansAssignments, labelClustersFromTokens, normalizeVector } from "./embedding-cluster.js";
import { tokenizeForKeywords } from "./keyword-tokenize.js";
const MIN_SAMPLES = 48;
const MAX_SAMPLES = 480;
const EMBED_BATCH = 12;
let pipelinePromise = null;
async function loadPipeline() {
    if (pipelinePromise)
        return pipelinePromise;
    pipelinePromise = (async () => {
        let mod;
        try {
            mod = await import("@xenova/transformers");
        }
        catch {
            throw new Error("[kca] --semantic-keywords requires optional dependency @xenova/transformers. " +
                "Reinstall kakaotalk-chat-analyzer or run without the flag.");
        }
        const { env, pipeline } = mod;
        env.cacheDir = join(homedir(), ".cache", "kakaotalk-chat-analyzer", "transformers");
        env.allowLocalModels = true;
        process.stderr.write("[kca] MiniLM 임베딩 모델 준비 중… (최초 1회, 무료)\n");
        return pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
            quantized: true,
        });
    })();
    return pipelinePromise;
}
function tensorToRows(tensor) {
    const data = tensor.data instanceof Float32Array ? tensor.data : Float32Array.from(tensor.data);
    const dims = tensor.dims;
    if (dims.length === 1) {
        return [normalizeVector([...data])];
    }
    const rows = dims[0] ?? 1;
    const dim = dims[1] ?? data.length;
    const out = [];
    for (let r = 0; r < rows; r += 1) {
        const row = [];
        for (let d = 0; d < dim; d += 1)
            row.push(data[r * dim + d]);
        out.push(normalizeVector(row));
    }
    return out;
}
async function embedMessages(pipe, messages, onBatch) {
    const clipped = messages.slice(0, MAX_SAMPLES).map((m) => m.slice(0, 512));
    const vectors = [];
    for (let i = 0; i < clipped.length; i += EMBED_BATCH) {
        const batch = clipped.slice(i, i + EMBED_BATCH);
        const tensor = await pipe(batch, { pooling: "mean", normalize: true });
        vectors.push(...tensorToRows(tensor));
        onBatch?.(Math.min(i + batch.length, clipped.length), clipped.length);
    }
    return vectors;
}
/** MiniLM 임베딩 + k-means → 클러스터 대표 키워드 */
export async function extractSemanticKeywords(messages, options) {
    if (process.env.KCA_NO_SEMANTIC === "1")
        return [];
    const samples = messages.filter((m) => m.length >= 12);
    if (samples.length < MIN_SAMPLES)
        return [];
    const pipe = await loadPipeline();
    const vectors = await embedMessages(pipe, samples, options.onProgress);
    if (vectors.length < MIN_SAMPLES)
        return [];
    const tokenBags = samples.map((m) => tokenizeForKeywords(m));
    const k = Math.max(4, Math.min(14, Math.floor(Math.sqrt(vectors.length / 18))));
    const assignments = kMeansAssignments(vectors, k);
    const labels = labelClustersFromTokens(assignments, tokenBags, k, options.stopwords, 4);
    const limit = options.limit ?? 24;
    const items = [];
    const seen = new Set();
    for (const cluster of labels) {
        const label = cluster.terms.slice(0, 2).join(" ");
        if (!label || seen.has(label) || options.stopwords.has(label))
            continue;
        seen.add(label);
        const score = (cluster.size / vectors.length) * 100;
        items.push({
            label,
            score,
            messageHits: cluster.size,
        });
        if (items.length >= limit)
            break;
    }
    return items.sort((a, b) => b.score - a.score || b.messageHits - a.messageHits);
}
//# sourceMappingURL=semantic-keywords.js.map