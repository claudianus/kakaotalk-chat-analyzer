import type { SentimentStats } from "./types.js";
import { isLocalBundledSentimentModel } from "./ml-bundled-models.js";
import {
  binarySentimentConfidenceHigh,
  isBinarySentimentModel,
  sentimentModelFallbacks,
  sentimentModelId,
  sentimentSampleCap,
  subsampleSentimentRecords,
} from "./sentiment-policy.js";
import type { BuildReportOptions } from "./analyze-pool.js";
import { resolvePresetNameWithAuto } from "./analysis-preset.js";
import { runWithHubMirrors } from "./ml-hub-access.js";
import { configureTransformersEnv, preferQuantizedModels } from "./ml-runtime.js";
import { isTransformersFetchError, withLocalModelsOnly } from "./ml-transformers-env.js";
import { withQuietMlStderr } from "./ml-stderr.js";
import { resolveSentimentBatchSize } from "./ml-batch-size.js";
import { ensureCoreMlBundles } from "./ml-bundle-install.js";

const MIN_SAMPLES = 48;

export type SentimentLabel = "positive" | "negative" | "neutral";

export interface SentimentBatchItem {
  text: string;
  sender: string;
}

type ClassificationPipeline = (
  input: string | string[],
) => Promise<
  | { label: string; score: number }
  | { label: string; score: number }[]
>;

let pipelinePromise: Promise<ClassificationPipeline> | null = null;
let loadedModelId: string | null = null;
let loadKey: string | null = null;

function normalizeLabel(raw: string, modelId?: string, score?: number): SentimentLabel {
  const id = raw.toLowerCase();
  if (modelId && isBinarySentimentModel(modelId) && score !== undefined) {
    const high = binarySentimentConfidenceHigh();
    if (score < high) return "neutral";
    if (id.includes("pos") || id === "label_1") return "positive";
    if (id.includes("neg") || id === "label_0") return "negative";
    return "neutral";
  }
  const starMatch = id.match(/^(\d)\s*stars?$/);
  if (starMatch) {
    const stars = Number(starMatch[1]);
    if (stars <= 2) return "negative";
    if (stars >= 4) return "positive";
    return "neutral";
  }
  if (modelId?.includes("klue")) {
    if (id === "label_0" || id.includes("neg")) return "negative";
    if (id === "label_1" || id.includes("neu")) return "neutral";
    if (id === "label_2" || id.includes("pos")) return "positive";
  }
  if (id.includes("pos") || id === "label_2") return "positive";
  if (id.includes("neg") || id === "label_0") return "negative";
  return "neutral";
}

function resolveSentimentBuildOptions(
  buildOptions?: BuildReportOptions,
  messageCount?: number,
): BuildReportOptions | undefined {
  if (!buildOptions && messageCount === undefined) return buildOptions;
  const preset =
    buildOptions?.preset ??
    (messageCount !== undefined ? resolvePresetNameWithAuto(buildOptions, messageCount) : undefined);
  return { ...buildOptions, preset };
}

async function importTransformers(): Promise<typeof import("@xenova/transformers")> {
  try {
    return await import("@xenova/transformers");
  } catch {
    throw new Error(
      "[kca] 감정 분석은 optional dependency @xenova/transformers 가 필요합니다. " +
        "재설치하거나 --no-sentiment / KCA_NO_SENTIMENT=1 로 끄세요.",
    );
  }
}

async function instantiateSentimentPipeline(
  mod: typeof import("@xenova/transformers"),
  modelId: string,
  quantized: boolean,
): Promise<ClassificationPipeline> {
  const { pipeline } = mod;
  return (await pipeline("text-classification", modelId, {
    quantized,
  })) as ClassificationPipeline;
}

async function loadPipeline(
  buildOptions?: BuildReportOptions,
  messageCount?: number,
): Promise<ClassificationPipeline> {
  const opts = resolveSentimentBuildOptions(buildOptions, messageCount);
  await ensureCoreMlBundles();
  const preset = opts?.preset;
  const candidates = sentimentModelFallbacks(preset, messageCount, opts);
  const key = candidates.join("|");
  if (pipelinePromise && loadedModelId && loadKey === key) return pipelinePromise;

  pipelinePromise = null;
  loadedModelId = null;
  loadKey = key;

  pipelinePromise = withQuietMlStderr(async () => {
    const mod = await importTransformers();
    const gpu = await configureTransformersEnv(mod);
    const quantized = preferQuantizedModels(gpu);
    let lastError: unknown;
    for (let i = 0; i < candidates.length; i += 1) {
      const modelId = candidates[i]!;
      try {
        if (i > 0) {
          const msg = lastError instanceof Error ? lastError.message : String(lastError);
          process.stderr.write(`[kca] 감정 모델 ${candidates[i - 1]} 로드 실패 → ${modelId}: ${msg}\n`);
        }
        process.stderr.write(
          `[kca] 감정 분석 준비 중… (${modelId}${quantized ? "" : ", full precision"})\n`,
        );
        const load = () => instantiateSentimentPipeline(mod, modelId, quantized);
        const pipe = isLocalBundledSentimentModel(modelId)
          ? await withLocalModelsOnly(mod, load)
          : await runWithHubMirrors(mod, load);
        loadedModelId = modelId;
        return pipe;
      } catch (error) {
        lastError = error;
        if (i < candidates.length - 1) continue;
        const msg = error instanceof Error ? error.message : String(error);
        const hint = isTransformersFetchError(error)
          ? " 네트워크·cwd의 tokenizer.json(이름 변경)을 확인하세요. 게이트 모델만 KCA_USE_HF_TOKEN=1 과 유효한 HF 토큰이 필요합니다."
          : "";
        throw new Error(`${msg}${hint}`, { cause: error });
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  });

  return pipelinePromise;
}

/** Kiwi 준비·키워드 패스와 병렬 워밍업 */
export function preloadSentimentPipeline(
  buildOptions?: BuildReportOptions,
  messageCount?: number,
): Promise<ClassificationPipeline> {
  return loadPipeline(buildOptions, messageCount);
}

/** LLM 직전 ONNX 해제 */
export async function disposeSentimentPipeline(): Promise<void> {
  if (!pipelinePromise) return;
  try {
    const pipe = await pipelinePromise.catch(() => null);
    const dispose = (pipe as { dispose?: () => Promise<void> } | null)?.dispose;
    if (dispose) await dispose.call(pipe);
  } catch {
    /* ignore */
  }
  pipelinePromise = null;
  loadedModelId = null;
  loadKey = null;
}

function asBatchOutput(
  out: { label: string; score: number } | { label: string; score: number }[],
): { label: string; score: number }[] {
  return Array.isArray(out) ? out : [out];
}

export async function analyzeSentimentBatch(
  messages: string[],
  onProgress?: (done: number, total: number) => void,
  buildOptions?: BuildReportOptions,
  messageCount?: number,
): Promise<SentimentLabel[]> {
  if (messages.length === 0) return [];
  const opts = resolveSentimentBuildOptions(buildOptions, messageCount);
  const modelId = sentimentModelId(opts?.preset, messageCount, opts);
  const pipe = await loadPipeline(buildOptions, messageCount);
  const labels: SentimentLabel[] = [];
  const batchSize = resolveSentimentBatchSize();
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize).map((m) => m.slice(0, 512));
    const out = await pipe(batch.length === 1 ? batch[0]! : batch);
    const rows = asBatchOutput(out);
    for (const row of rows)
      labels.push(normalizeLabel(row.label, loadedModelId ?? modelId, row.score));
    onProgress?.(Math.min(i + batch.length, messages.length), messages.length);
  }
  return labels;
}

export function buildSentimentStats(
  samples: SentimentBatchItem[],
  labels: SentimentLabel[],
  aliasBySender: Map<string, string>,
): SentimentStats {
  const sampleSize = labels.length;
  let positive = 0;
  let negative = 0;
  let neutral = 0;
  for (const label of labels) {
    if (label === "positive") positive += 1;
    else if (label === "negative") negative += 1;
    else neutral += 1;
  }
  const positivePercent = sampleSize > 0 ? round((positive / sampleSize) * 100, 1) : 0;
  const negativePercent = sampleSize > 0 ? round((negative / sampleSize) * 100, 1) : 0;
  const neutralPercent = sampleSize > 0 ? round((neutral / sampleSize) * 100, 1) : 0;
  const compoundScore =
    sampleSize > 0 ? round(((positive - negative) / sampleSize) * 100, 1) : 0;

  const bySenderRaw = new Map<string, { pos: number; neg: number; neu: number; n: number }>();
  for (let i = 0; i < samples.length; i += 1) {
    const item = samples[i]!;
    const label = labels[i] ?? "neutral";
    const row = bySenderRaw.get(item.sender) ?? { pos: 0, neg: 0, neu: 0, n: 0 };
    row.n += 1;
    if (label === "positive") row.pos += 1;
    else if (label === "negative") row.neg += 1;
    else row.neu += 1;
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

export async function analyzeSentimentFromSamples(
  samples: SentimentBatchItem[],
  corpusMessages: number,
  aliasBySender: Map<string, string>,
  onProgress?: (done: number, total: number) => void,
  buildOptions?: BuildReportOptions,
): Promise<SentimentStats | null> {
  if (samples.length < MIN_SAMPLES) return null;
  const cap = sentimentSampleCap(Math.max(corpusMessages, samples.length));
  const subsampled = subsampleSentimentRecords(samples, cap);
  const labels = await analyzeSentimentBatch(
    subsampled.map((s) => s.text),
    onProgress,
    buildOptions,
    corpusMessages,
  );
  return buildSentimentStats(subsampled, labels, aliasBySender);
}

function round(n: number, digits: number): number {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}
