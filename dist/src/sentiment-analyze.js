import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_SENTIMENT_MODEL, sentimentModelId, sentimentSampleCap, subsampleSentimentRecords, } from "./sentiment-policy.js";
import { configureTransformersEnv } from "./ml-runtime.js";
import { resolveSentimentBatchSize } from "./ml-batch-size.js";
const MIN_SAMPLES = 48;
let pipelinePromise = null;
let loadedModelId = null;
function normalizeLabel(raw, modelId) {
    const id = raw.toLowerCase();
    if (modelId?.includes("klue")) {
        if (id === "label_0" || id.includes("neg"))
            return "negative";
        if (id === "label_1" || id.includes("neu"))
            return "neutral";
        if (id === "label_2" || id.includes("pos"))
            return "positive";
    }
    if (id.includes("pos") || id === "label_2" || id === "5 stars")
        return "positive";
    if (id.includes("neg") || id === "label_0" || id === "1 star")
        return "negative";
    return "neutral";
}
async function loadPipeline(buildOptions) {
    const preset = buildOptions?.preset;
    const modelId = sentimentModelId(preset);
    if (pipelinePromise && loadedModelId === modelId)
        return pipelinePromise;
    pipelinePromise = null;
    loadedModelId = modelId;
    pipelinePromise = (async () => {
        let mod;
        try {
            mod = await import("@xenova/transformers");
        }
        catch {
            throw new Error("[kca] 감정 분석은 optional dependency @xenova/transformers 가 필요합니다. " +
                "재설치하거나 --no-sentiment / KCA_NO_SENTIMENT=1 로 끄세요.");
        }
        const { env, pipeline } = mod;
        await configureTransformersEnv(mod);
        env.cacheDir = join(homedir(), ".cache", "kakaotalk-chat-analyzer", "transformers");
        env.allowLocalModels = true;
        process.stderr.write(`[kca] 감정 분석 준비 중… (${modelId}, 최초 1회)\n`);
        try {
            return (await pipeline("text-classification", modelId, {
                quantized: true,
            }));
        }
        catch (error) {
            if (modelId === DEFAULT_SENTIMENT_MODEL)
                throw error;
            const msg = error instanceof Error ? error.message : String(error);
            process.stderr.write(`[kca] 감정 모델 ${modelId} 로드 실패 → ${DEFAULT_SENTIMENT_MODEL}: ${msg}\n`);
            loadedModelId = DEFAULT_SENTIMENT_MODEL;
            return pipeline("text-classification", DEFAULT_SENTIMENT_MODEL, {
                quantized: true,
            });
        }
    })();
    return pipelinePromise;
}
/** Kiwi 준비·키워드 패스와 병렬 워밍업 */
export function preloadSentimentPipeline(buildOptions) {
    return loadPipeline(buildOptions);
}
function asBatchOutput(out) {
    return Array.isArray(out) ? out : [out];
}
export async function analyzeSentimentBatch(messages, onProgress, buildOptions) {
    if (messages.length === 0)
        return [];
    const modelId = sentimentModelId(buildOptions?.preset);
    const pipe = await loadPipeline(buildOptions);
    const labels = [];
    const batchSize = resolveSentimentBatchSize();
    for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize).map((m) => m.slice(0, 512));
        const out = await pipe(batch.length === 1 ? batch[0] : batch);
        const rows = asBatchOutput(out);
        for (const row of rows)
            labels.push(normalizeLabel(row.label, modelId));
        onProgress?.(Math.min(i + batch.length, messages.length), messages.length);
    }
    return labels;
}
export function buildSentimentStats(samples, labels, aliasBySender) {
    const sampleSize = labels.length;
    let positive = 0;
    let negative = 0;
    let neutral = 0;
    for (const label of labels) {
        if (label === "positive")
            positive += 1;
        else if (label === "negative")
            negative += 1;
        else
            neutral += 1;
    }
    const positivePercent = sampleSize > 0 ? round((positive / sampleSize) * 100, 1) : 0;
    const negativePercent = sampleSize > 0 ? round((negative / sampleSize) * 100, 1) : 0;
    const neutralPercent = sampleSize > 0 ? round((neutral / sampleSize) * 100, 1) : 0;
    const compoundScore = sampleSize > 0 ? round(((positive - negative) / sampleSize) * 100, 1) : 0;
    const bySenderRaw = new Map();
    for (let i = 0; i < samples.length; i += 1) {
        const item = samples[i];
        const label = labels[i] ?? "neutral";
        const row = bySenderRaw.get(item.sender) ?? { pos: 0, neg: 0, neu: 0, n: 0 };
        row.n += 1;
        if (label === "positive")
            row.pos += 1;
        else if (label === "negative")
            row.neg += 1;
        else
            row.neu += 1;
        bySenderRaw.set(item.sender, row);
    }
    const bySender = [...bySenderRaw.entries()]
        .map(([raw, row]) => ({
        alias: aliasBySender.get(raw) ?? "???",
        positivePercent: row.n > 0 ? round((row.pos / row.n) * 100, 1) : 0,
        negativePercent: row.n > 0 ? round((row.neg / row.n) * 100, 1) : 0,
        sampleMessages: row.n,
    }))
        .sort((a, b) => b.sampleMessages - a.sampleMessages || b.positivePercent - a.positivePercent)
        .slice(0, 12);
    return {
        sampleSize,
        positivePercent,
        negativePercent,
        neutralPercent,
        compoundScore,
        bySender,
    };
}
export async function analyzeSentimentFromSamples(samples, corpusMessages, aliasBySender, onProgress, buildOptions) {
    if (samples.length < MIN_SAMPLES)
        return null;
    const cap = sentimentSampleCap(Math.max(corpusMessages, samples.length));
    const subsampled = subsampleSentimentRecords(samples, cap);
    const labels = await analyzeSentimentBatch(subsampled.map((s) => s.text), onProgress, buildOptions);
    return buildSentimentStats(subsampled, labels, aliasBySender);
}
function round(n, digits) {
    const p = 10 ** digits;
    return Math.round(n * p) / p;
}
//# sourceMappingURL=sentiment-analyze.js.map