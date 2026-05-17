import { homedir } from "node:os";
import { join } from "node:path";
import { kMeansAssignments, labelClustersFromTokens, normalizeVector } from "./embedding-cluster.js";
import { tokenizeForKeywords } from "./keyword-tokenize.js";
import type { KeywordRankItem } from "./keyword-rank.js";
import { canonicalKeywordToken } from "./keyword-canonical.js";
import { isNoiseKeyword } from "./keyword-quality.js";
import {
  DEFAULT_KOREAN_SEMANTIC_MODEL,
  formatTextForEmbedding,
  semanticEmbeddingModelId,
  semanticSampleCap,
  subsampleSemanticMessages,
} from "./semantic-policy.js";
import type { BuildReportOptions } from "./analyze-pool.js";
import { configureTransformersEnv } from "./ml-runtime.js";

const MIN_SAMPLES = 48;
const EMBED_BATCH = 12;

type FeaturePipeline = (
  input: string | string[],
  options?: { pooling?: string; normalize?: boolean },
) => Promise<{ data: Float32Array | number[]; dims: number[] }>;

let pipelinePromise: Promise<FeaturePipeline> | null = null;
let loadedModelId: string | null = null;

async function loadPipelineForModel(modelId: string): Promise<FeaturePipeline> {
  let mod: typeof import("@xenova/transformers");
  try {
    mod = await import("@xenova/transformers");
  } catch {
    throw new Error(
      "[kca] 시맨틱 키워드는 optional dependency @xenova/transformers 가 필요합니다. " +
        "재설치하거나 --no-semantic-keywords 로 끄세요.",
    );
  }
  const { env, pipeline } = mod;
  await configureTransformersEnv(mod);
  env.cacheDir = join(homedir(), ".cache", "kakaotalk-chat-analyzer", "transformers");
  env.allowLocalModels = true;
  process.stderr.write(`[kca] 시맨틱 임베딩 준비 중… (${modelId}, 최초 1회)\n`);
  return pipeline("feature-extraction", modelId, {
    quantized: true,
  }) as Promise<FeaturePipeline>;
}

async function loadPipeline(buildOptions?: BuildReportOptions): Promise<FeaturePipeline> {
  const modelId = semanticEmbeddingModelId(buildOptions);
  if (pipelinePromise && loadedModelId === modelId) return pipelinePromise;
  pipelinePromise = null;
  loadedModelId = modelId;
  pipelinePromise = (async () => {
    try {
      return await loadPipelineForModel(modelId);
    } catch (error) {
      if (modelId === DEFAULT_KOREAN_SEMANTIC_MODEL) throw error;
      const msg = error instanceof Error ? error.message : String(error);
      process.stderr.write(
        `[kca] 시맨틱 모델 ${modelId} 로드 실패 → ${DEFAULT_KOREAN_SEMANTIC_MODEL}: ${msg}\n`,
      );
      loadedModelId = DEFAULT_KOREAN_SEMANTIC_MODEL;
      return loadPipelineForModel(DEFAULT_KOREAN_SEMANTIC_MODEL);
    }
  })();
  return pipelinePromise;
}

function tensorToRows(tensor: { data: Float32Array | number[]; dims: number[] }): number[][] {
  const data = tensor.data instanceof Float32Array ? tensor.data : Float32Array.from(tensor.data);
  const dims = tensor.dims;
  if (dims.length === 1) {
    return [normalizeVector([...data])];
  }
  const rows = dims[0] ?? 1;
  const dim = dims[1] ?? data.length;
  const out: number[][] = [];
  for (let r = 0; r < rows; r += 1) {
    const row: number[] = [];
    for (let d = 0; d < dim; d += 1) row.push(data[r * dim + d]!);
    out.push(normalizeVector(row));
  }
  return out;
}

async function embedMessages(
  pipe: FeaturePipeline,
  messages: string[],
  onBatch?: (done: number, total: number) => void,
  maxSamples = semanticSampleCap(messages.length),
  buildOptions?: BuildReportOptions,
): Promise<number[][]> {
  const modelId = loadedModelId ?? semanticEmbeddingModelId(buildOptions);
  const subsampled = subsampleSemanticMessages(messages, maxSamples);
  const clipped = subsampled.map((m) => formatTextForEmbedding(m.slice(0, 512), modelId));
  const vectors: number[][] = [];
  for (let i = 0; i < clipped.length; i += EMBED_BATCH) {
    const batch = clipped.slice(i, i + EMBED_BATCH);
    const tensor = await pipe(batch, { pooling: "mean", normalize: true });
    vectors.push(...tensorToRows(tensor));
    onBatch?.(Math.min(i + batch.length, clipped.length), clipped.length);
  }
  return vectors;
}

export interface SemanticKeywordOptions {
  stopwords: ReadonlySet<string>;
  /** 코퍼스 전체 메시지 수(임베딩 샘플 상한·리저보어 cap 정렬용) */
  corpusMessages?: number;
  limit?: number;
  minClusterCoherence?: number;
  onProgress?: (current: number, total: number) => void;
  buildOptions?: BuildReportOptions;
}

/** 다국어(한국어 우선) 임베딩 + k-means → 클러스터 대표 키워드 */
export async function extractSemanticKeywords(
  messages: string[],
  options: SemanticKeywordOptions,
): Promise<KeywordRankItem[]> {
  if (process.env.KCA_NO_SEMANTIC === "1") return [];
  const samples = messages.filter((m) => m.length >= 12);
  if (samples.length < MIN_SAMPLES) return [];

  const embedCap = semanticSampleCap(options.corpusMessages ?? samples.length);
  const pipe = await loadPipeline(options.buildOptions);
  const vectors = await embedMessages(pipe, samples, options.onProgress, embedCap, options.buildOptions);
  if (vectors.length < MIN_SAMPLES) return [];

  const tokenBags = samples.map((m) => tokenizeForKeywords(m));
  const k = Math.max(4, Math.min(14, Math.floor(Math.sqrt(vectors.length / 18))));
  const assignments = kMeansAssignments(vectors, k);
  const minCoherence = options.minClusterCoherence ?? 0.32;
  const labels = labelClustersFromTokens(
    assignments,
    tokenBags,
    k,
    options.stopwords,
    4,
    vectors,
    minCoherence,
  );

  const limit = options.limit ?? 24;
  const items: KeywordRankItem[] = [];
  const seen = new Set<string>();
  const seenCanonical = new Set<string>();

  for (const cluster of labels) {
    const label = cluster.terms.slice(0, 2).join(" ");
    if (!label || seen.has(label) || options.stopwords.has(label) || isNoiseKeyword(label)) continue;
    const canonKey = label
      .split(" ")
      .map((t) => canonicalKeywordToken(t))
      .join(" ");
    if (seenCanonical.has(canonKey)) continue;
    seen.add(label);
    seenCanonical.add(canonKey);
    const score = (cluster.size / vectors.length) * 100;
    items.push({
      label,
      score,
      messageHits: cluster.size,
    });
    if (items.length >= limit) break;
  }

  return items.sort((a, b) => b.score - a.score || b.messageHits - a.messageHits);
}
