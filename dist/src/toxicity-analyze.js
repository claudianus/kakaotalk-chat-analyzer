import { BUNDLED_TOXICITY_MODEL_ID, isBundledToxicityModelReady, isLocalBundledToxicityModel, } from "./ml-bundled-models.js";
import { ensureToxicityBundle } from "./ml-bundle-cache.js";
import { HUB_KCELECTRA_TOXICITY } from "./ml/model-ids.js";
import { resolveToxicityModelId } from "./ml/registry.js";
import { runWithHubMirrors } from "./ml-hub-access.js";
import { configureTransformersEnv, preferQuantizedModels } from "./ml-runtime.js";
import { isTransformersFetchError, withLocalModelsOnly } from "./ml-transformers-env.js";
import { withQuietMlStderr } from "./ml-stderr.js";
import { resolveSentimentBatchSize } from "./ml-batch-size.js";
import { normalizeProfanityText, loadProfanityPatterns } from "./profanity.js";
const MIN_SAMPLES = 48;
let pipelinePromise = null;
let loadedModelId = null;
async function importTransformers() {
    try {
        return await import("@huggingface/transformers");
    }
    catch {
        throw new Error("[kca] 독성 ML은 optional dependency @huggingface/transformers 가 필요합니다. KCA_NO_TOXICITY=1 로 끄세요.");
    }
}
function lexiconToxicityFromSamples(samples) {
    const patterns = loadProfanityPatterns()
        .map((p) => normalizeProfanityText(p))
        .filter((p) => p.length >= 2);
    let toxic = 0;
    for (const { text } of samples) {
        const n = normalizeProfanityText(text);
        if (patterns.some((p) => n.includes(p)))
            toxic += 1;
    }
    const sampleSize = samples.length;
    const toxicPercent = sampleSize > 0 ? Math.round((toxic / sampleSize) * 1000) / 10 : 0;
    return {
        sampleSize,
        toxicPercent,
        neutralPercent: Math.round((100 - toxicPercent) * 10) / 10,
        messagesWithToxicity: toxic,
        usedMlModel: false,
        tier: "lexicon",
    };
}
function scoreToToxicPercent(score, label) {
    const id = label.toLowerCase();
    const toxic = id.includes("neg") || id === "label_0" || id.includes("toxic") || id.includes("offensive");
    if (toxic)
        return Math.round(score * 1000) / 10;
    return Math.round((1 - score) * 30) / 10;
}
async function resolveToxicityLoadModelId(requestedId) {
    if (requestedId !== BUNDLED_TOXICITY_MODEL_ID)
        return requestedId;
    if (isBundledToxicityModelReady())
        return BUNDLED_TOXICITY_MODEL_ID;
    const ok = await ensureToxicityBundle();
    if (ok && isBundledToxicityModelReady())
        return BUNDLED_TOXICITY_MODEL_ID;
    return HUB_KCELECTRA_TOXICITY;
}
async function loadPipeline(requestedModelId) {
    const modelId = await resolveToxicityLoadModelId(requestedModelId);
    if (pipelinePromise && loadedModelId === modelId)
        return pipelinePromise;
    if (loadedModelId !== modelId) {
        pipelinePromise = null;
        loadedModelId = null;
    }
    if (!pipelinePromise) {
        pipelinePromise = withQuietMlStderr(async () => {
            const mod = await importTransformers();
            const gpu = await configureTransformersEnv(mod);
            const dtype = preferQuantizedModels(gpu);
            if (isLocalBundledToxicityModel(modelId)) {
                const { bundledMlModelsDir } = await import("./ml-bundled-models.js");
                mod.env.localModelPath = bundledMlModelsDir();
            }
            const { pipeline } = mod;
            const load = () => pipeline("text-classification", modelId, { dtype });
            let pipe;
            if (isLocalBundledToxicityModel(modelId)) {
                try {
                    pipe = await withLocalModelsOnly(mod, load);
                }
                catch (err) {
                    // 로컬 번들이 손상되었거나 tokenizer가 누락된 경우 Hub 폰백
                    if (isTransformersFetchError(err)) {
                        process.stderr.write(`[kca] 독성 번들 로드 실패(${modelId}) → Hub 폰백(${HUB_KCELECTRA_TOXICITY})\n`);
                        const hubLoad = () => pipeline("text-classification", HUB_KCELECTRA_TOXICITY, { dtype });
                        pipe = await runWithHubMirrors(mod, hubLoad);
                        loadedModelId = HUB_KCELECTRA_TOXICITY;
                    }
                    else {
                        throw err;
                    }
                }
            }
            else if (modelId === BUNDLED_TOXICITY_MODEL_ID) {
                // bundled ID인데 local에 없으면 Hub public 모델로 폰백
                const hubLoad = () => pipeline("text-classification", HUB_KCELECTRA_TOXICITY, { dtype });
                pipe = await runWithHubMirrors(mod, hubLoad);
                loadedModelId = HUB_KCELECTRA_TOXICITY;
            }
            else {
                pipe = await runWithHubMirrors(mod, load);
            }
            if (!loadedModelId)
                loadedModelId = modelId;
            return pipe;
        });
    }
    return pipelinePromise;
}
export async function preloadToxicityPipeline() {
    const modelId = resolveToxicityModelId();
    if (!modelId)
        return;
    await loadPipeline(modelId);
}
/** LLM 직전 ONNX 해제 */
export async function disposeToxicityPipeline() {
    if (!pipelinePromise)
        return;
    try {
        const pipe = await pipelinePromise.catch(() => null);
        const dispose = pipe?.dispose;
        if (dispose)
            await dispose.call(pipe);
    }
    catch {
        /* ignore */
    }
    pipelinePromise = null;
    loadedModelId = null;
}
export async function analyzeToxicityFromSamples(samples, corpusMessages) {
    if (samples.length < MIN_SAMPLES)
        return null;
    const modelId = resolveToxicityModelId();
    if (!modelId)
        return null;
    try {
        const pipe = await loadPipeline(modelId);
        const resolvedModelId = loadedModelId ?? modelId;
        const batchSize = resolveSentimentBatchSize();
        let toxicSum = 0;
        let count = 0;
        for (let i = 0; i < samples.length; i += batchSize) {
            const batch = samples.slice(i, i + batchSize).map((s) => s.text.slice(0, 512));
            const out = await pipe(batch.length === 1 ? batch[0] : batch);
            const rows = Array.isArray(out) ? out : [out];
            for (const row of rows) {
                const pct = scoreToToxicPercent(row.score, row.label);
                toxicSum += pct;
                count += 1;
            }
        }
        const avgToxic = count > 0 ? toxicSum / count : 0;
        const toxicPercent = Math.round(avgToxic * 10) / 10;
        const messagesWithToxicity = Math.round((toxicPercent / 100) * samples.length);
        return {
            sampleSize: samples.length,
            toxicPercent,
            neutralPercent: Math.round((100 - toxicPercent) * 10) / 10,
            messagesWithToxicity,
            usedMlModel: true,
            modelId: resolvedModelId,
            tier: "ml",
        };
    }
    catch (error) {
        if (isTransformersFetchError(error)) {
            return lexiconToxicityFromSamples(samples);
        }
        throw error;
    }
}
//# sourceMappingURL=toxicity-analyze.js.map