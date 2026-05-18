import type { ToxicityStats } from "./types.js";
import { isLocalBundledToxicityModel } from "./ml-bundled-models.js";
import { resolveToxicityModelId } from "./ml/registry.js";
import type { SentimentBatchItem } from "./sentiment-analyze.js";
import { runWithHubMirrors } from "./ml-hub-access.js";
import { configureTransformersEnv, preferQuantizedModels } from "./ml-runtime.js";
import { isTransformersFetchError } from "./ml-transformers-env.js";
import { withQuietMlStderr } from "./ml-stderr.js";
import { resolveSentimentBatchSize } from "./ml-batch-size.js";
import { normalizeProfanityText, loadProfanityPatterns } from "./profanity.js";

const MIN_SAMPLES = 48;

type ClassificationPipeline = (
  input: string | string[],
) => Promise<
  | { label: string; score: number }
  | { label: string; score: number }[]
>;

let pipelinePromise: Promise<ClassificationPipeline> | null = null;
let loadedModelId: string | null = null;

async function importTransformers(): Promise<typeof import("@xenova/transformers")> {
  try {
    return await import("@xenova/transformers");
  } catch {
    throw new Error(
      "[kca] 독성 ML은 optional dependency @xenova/transformers 가 필요합니다. KCA_NO_TOXICITY=1 로 끄세요.",
    );
  }
}

function lexiconToxicityFromSamples(samples: SentimentBatchItem[]): ToxicityStats {
  const patterns = loadProfanityPatterns()
    .map((p) => normalizeProfanityText(p))
    .filter((p) => p.length >= 2);
  let toxic = 0;
  for (const { text } of samples) {
    const n = normalizeProfanityText(text);
    if (patterns.some((p) => n.includes(p))) toxic += 1;
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

function scoreToToxicPercent(score: number, label: string): number {
  const id = label.toLowerCase();
  const toxic =
    id.includes("neg") || id === "label_0" || id.includes("toxic") || id.includes("offensive");
  if (toxic) return Math.round(score * 1000) / 10;
  return Math.round((1 - score) * 30) / 10;
}

async function loadPipeline(modelId: string): Promise<ClassificationPipeline> {
  if (pipelinePromise && loadedModelId === modelId) return pipelinePromise;
  pipelinePromise = null;
  loadedModelId = null;
  pipelinePromise = withQuietMlStderr(async () => {
    const mod = await importTransformers();
    const gpu = await configureTransformersEnv(mod);
    const quantized = preferQuantizedModels(gpu);
    if (isLocalBundledToxicityModel(modelId)) {
      const { bundledMlModelsDir } = await import("./ml-bundled-models.js");
      mod.env.localModelPath = bundledMlModelsDir();
    }
    const { pipeline } = mod;
    const load = () =>
      pipeline("text-classification", modelId, { quantized }) as Promise<ClassificationPipeline>;
    const pipe = isLocalBundledToxicityModel(modelId) ? await load() : await runWithHubMirrors(mod, load);
    loadedModelId = modelId;
    return pipe;
  });
  return pipelinePromise;
}

export async function preloadToxicityPipeline(): Promise<void> {
  const modelId = resolveToxicityModelId();
  if (!modelId) return;
  await loadPipeline(modelId);
}

export async function analyzeToxicityFromSamples(
  samples: SentimentBatchItem[],
  corpusMessages: number,
): Promise<ToxicityStats | null> {
  if (samples.length < MIN_SAMPLES) return null;
  const modelId = resolveToxicityModelId();
  if (!modelId) {
    if (process.env.KCA_TOXICITY === "1") return lexiconToxicityFromSamples(samples);
    return null;
  }

  try {
    const pipe = await loadPipeline(modelId);
    const batchSize = resolveSentimentBatchSize();
    let toxicSum = 0;
    let count = 0;
    for (let i = 0; i < samples.length; i += batchSize) {
      const batch = samples.slice(i, i + batchSize).map((s) => s.text.slice(0, 512));
      const out = await pipe(batch.length === 1 ? batch[0]! : batch);
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
      modelId,
      tier: "ml",
    };
  } catch (error) {
    if (isTransformersFetchError(error)) {
      return lexiconToxicityFromSamples(samples);
    }
    throw error;
  }
}
