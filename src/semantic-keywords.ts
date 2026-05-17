import { homedir } from "node:os";
import { join } from "node:path";
import { kMeansAssignments, labelClustersFromTokens, normalizeVector } from "./embedding-cluster.js";
import { tokenizeForKeywords } from "./keyword-tokenize.js";
import type { KeywordRankItem } from "./keyword-rank.js";
import { formatTextForEmbedding, semanticEmbeddingModelId, semanticSampleCap } from "./semantic-policy.js";

const MIN_SAMPLES = 48;
const EMBED_BATCH = 12;

type FeaturePipeline = (
  input: string | string[],
  options?: { pooling?: string; normalize?: boolean },
) => Promise<{ data: Float32Array | number[]; dims: number[] }>;

let pipelinePromise: Promise<FeaturePipeline> | null = null;
let loadedModelId: string | null = null;

async function loadPipeline(): Promise<FeaturePipeline> {
  const modelId = semanticEmbeddingModelId();
  if (pipelinePromise && loadedModelId === modelId) return pipelinePromise;
  pipelinePromise = null;
  loadedModelId = modelId;
  pipelinePromise = (async () => {
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
    env.cacheDir = join(homedir(), ".cache", "kakaotalk-chat-analyzer", "transformers");
    env.allowLocalModels = true;
    process.stderr.write(`[kca] 시맨틱 임베딩 준비 중… (${modelId}, 최초 1회)\n`);
    return pipeline("feature-extraction", modelId, {
      quantized: true,
    }) as Promise<FeaturePipeline>;
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

/** 리저보어가 cap보다 많을 때 무작위 subsample */
function subsampleMessages(messages: string[], cap: number): string[] {
  if (messages.length <= cap) return messages;
  const indices = messages.map((_, i) => i);
  for (let i = 0; i < cap; i += 1) {
    const j = i + Math.floor(Math.random() * (indices.length - i));
    [indices[i], indices[j]] = [indices[j]!, indices[i]!];
  }
  return indices.slice(0, cap).map((i) => messages[i]!);
}

async function embedMessages(
  pipe: FeaturePipeline,
  messages: string[],
  onBatch?: (done: number, total: number) => void,
  maxSamples = semanticSampleCap(messages.length),
): Promise<number[][]> {
  const modelId = semanticEmbeddingModelId();
  const clipped = messages
    .slice(0, maxSamples)
    .map((m) => formatTextForEmbedding(m.slice(0, 512), modelId));
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
  onProgress?: (current: number, total: number) => void;
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
  const forEmbed =
    samples.length > embedCap ? subsampleMessages(samples, embedCap) : samples;
  const pipe = await loadPipeline();
  const vectors = await embedMessages(pipe, forEmbed, options.onProgress, embedCap);
  if (vectors.length < MIN_SAMPLES) return [];

  const tokenBags = samples.map((m) => tokenizeForKeywords(m));
  const k = Math.max(4, Math.min(14, Math.floor(Math.sqrt(vectors.length / 18))));
  const assignments = kMeansAssignments(vectors, k);
  const labels = labelClustersFromTokens(
    assignments,
    tokenBags,
    k,
    options.stopwords,
    4,
    vectors,
    0.32,
  );

  const limit = options.limit ?? 24;
  const items: KeywordRankItem[] = [];
  const seen = new Set<string>();

  for (const cluster of labels) {
    const label = cluster.terms.slice(0, 2).join(" ");
    if (!label || seen.has(label) || options.stopwords.has(label)) continue;
    seen.add(label);
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
