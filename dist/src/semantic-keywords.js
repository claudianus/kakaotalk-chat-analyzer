import { kMeansAssignments, labelClustersFromTokens, normalizeVector } from "./embedding-cluster.js";
import { tokenizeForKeywords } from "./keyword-tokenize.js";
import { canonicalKeywordToken } from "./keyword-canonical.js";
import { isNoiseKeyword } from "./keyword-quality.js";
import { DEFAULT_KOREAN_SEMANTIC_MODEL, formatTextForEmbedding, semanticEmbeddingModelId, semanticSampleCap, subsampleSemanticMessages, } from "./semantic-policy.js";
import { runWithHubMirrors } from "./ml-hub-access.js";
import { configureTransformersEnv, preferQuantizedModels } from "./ml-runtime.js";
import { withQuietMlStderr } from "./ml-stderr.js";
import { resolveEmbedBatchSize } from "./ml-batch-size.js";
const MIN_SAMPLES = 48;
let pipelinePromise = null;
let loadedModelId = null;
async function loadPipelineForModel(modelId) {
    return withQuietMlStderr(async () => {
        let mod;
        try {
            mod = await import("@xenova/transformers");
        }
        catch {
            throw new Error("[kca] 시맨틱 키워드는 optional dependency @xenova/transformers 가 필요합니다. " +
                "재설치하거나 --no-semantic-keywords 로 끄세요.");
        }
        const { pipeline } = mod;
        const gpu = await configureTransformersEnv(mod);
        const quantized = preferQuantizedModels(gpu);
        process.stderr.write(`[kca] 시맨틱 임베딩 준비 중… (${modelId}${quantized ? "" : ", full precision"})\n`);
        return runWithHubMirrors(mod, () => pipeline("feature-extraction", modelId, {
            quantized,
        }));
    });
}
async function loadPipeline(buildOptions, messageCount) {
    const modelId = semanticEmbeddingModelId(buildOptions, messageCount);
    if (pipelinePromise && loadedModelId === modelId)
        return pipelinePromise;
    pipelinePromise = null;
    loadedModelId = modelId;
    pipelinePromise = (async () => {
        try {
            return await loadPipelineForModel(modelId);
        }
        catch (error) {
            if (modelId === DEFAULT_KOREAN_SEMANTIC_MODEL)
                throw error;
            const msg = error instanceof Error ? error.message : String(error);
            process.stderr.write(`[kca] 시맨틱 모델 ${modelId} 로드 실패 → ${DEFAULT_KOREAN_SEMANTIC_MODEL}: ${msg}\n`);
            loadedModelId = DEFAULT_KOREAN_SEMANTIC_MODEL;
            return loadPipelineForModel(DEFAULT_KOREAN_SEMANTIC_MODEL);
        }
    })();
    return pipelinePromise;
}
/** Kiwi 준비·키워드 패스와 병렬 워밍업 */
export function preloadSemanticPipeline(buildOptions, messageCount) {
    return loadPipeline(buildOptions, messageCount);
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
async function embedMessages(pipe, messages, onBatch, maxSamples = semanticSampleCap(messages.length), buildOptions) {
    const modelId = loadedModelId ?? semanticEmbeddingModelId(buildOptions);
    const subsampled = subsampleSemanticMessages(messages, maxSamples);
    const clipped = subsampled.map((m) => formatTextForEmbedding(m.slice(0, 512), modelId));
    const vectors = [];
    const embedBatch = resolveEmbedBatchSize();
    for (let i = 0; i < clipped.length; i += embedBatch) {
        const batch = clipped.slice(i, i + embedBatch);
        const tensor = await pipe(batch, { pooling: "mean", normalize: true });
        vectors.push(...tensorToRows(tensor));
        onBatch?.(Math.min(i + batch.length, clipped.length), clipped.length);
    }
    return vectors;
}
/** 다국어(한국어 우선) 임베딩 + k-means → 클러스터 대표 키워드 */
export async function extractSemanticKeywords(messages, options) {
    if (process.env.KCA_NO_SEMANTIC === "1")
        return [];
    const samples = messages.filter((m) => m.length >= 12);
    if (samples.length < MIN_SAMPLES)
        return [];
    const embedCap = semanticSampleCap(options.corpusMessages ?? samples.length);
    const pipe = await loadPipeline(options.buildOptions, options.corpusMessages ?? samples.length);
    const vectors = await embedMessages(pipe, samples, options.onProgress, embedCap, options.buildOptions);
    if (vectors.length < MIN_SAMPLES)
        return [];
    const tokenBags = samples.map((m) => tokenizeForKeywords(m));
    const k = Math.max(4, Math.min(14, Math.floor(Math.sqrt(vectors.length / 18))));
    const assignments = kMeansAssignments(vectors, k);
    const minCoherence = options.minClusterCoherence ?? 0.32;
    const labels = labelClustersFromTokens(assignments, tokenBags, k, options.stopwords, 4, vectors, minCoherence);
    const limit = options.limit ?? 24;
    const items = [];
    const seen = new Set();
    const seenCanonical = new Set();
    for (const cluster of labels) {
        const label = cluster.terms.slice(0, 2).join(" ");
        if (!label || seen.has(label) || options.stopwords.has(label) || isNoiseKeyword(label))
            continue;
        const canonKey = label
            .split(" ")
            .map((t) => canonicalKeywordToken(t))
            .join(" ");
        if (seenCanonical.has(canonKey))
            continue;
        seen.add(label);
        seenCanonical.add(canonKey);
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