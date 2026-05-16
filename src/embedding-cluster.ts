import { isNoiseKeyword } from "./keyword-quality.js";

export function normalizeVector(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const n = Math.sqrt(sum) || 1;
  return v.map((x) => x / n);
}

function cosineDistance(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += a[i]! * b[i]!;
  return 1 - dot;
}

/** L2 정규화 벡터에 대한 간단 k-means */
export function kMeansAssignments(vectors: number[][], k: number, maxIter = 12): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0]!.length;
  k = Math.max(1, Math.min(k, vectors.length));

  const centroids: number[][] = [];
  const step = Math.max(1, Math.floor(vectors.length / k));
  for (let i = 0; i < k; i += 1) {
    centroids.push([...vectors[Math.min(i * step, vectors.length - 1)]!]);
  }

  const assignments = new Array<number>(vectors.length).fill(0);

  for (let iter = 0; iter < maxIter; iter += 1) {
    let changed = false;
    for (let i = 0; i < vectors.length; i += 1) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c += 1) {
        const d = cosineDistance(vectors[i]!, centroids[c]!);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (assignments[i] !== best) {
        assignments[i] = best;
        changed = true;
      }
    }
    if (!changed && iter > 0) break;

    const sums = Array.from({ length: k }, () => new Array<number>(dim).fill(0));
    const counts = new Array<number>(k).fill(0);
    for (let i = 0; i < vectors.length; i += 1) {
      const a = assignments[i]!;
      counts[a] += 1;
      for (let d = 0; d < dim; d += 1) sums[a]![d] += vectors[i]![d]!;
    }
    for (let c = 0; c < k; c += 1) {
      if (counts[c] === 0) continue;
      centroids[c] = normalizeVector(sums[c]!.map((s) => s / counts[c]!));
    }
  }

  return assignments;
}

export interface ClusterLabel {
  terms: string[];
  size: number;
}

/** 클러스터별 토큰 빈도 상위 용어 */
export function labelClustersFromTokens(
  assignments: number[],
  tokenBags: string[][],
  k: number,
  stopwords: ReadonlySet<string>,
  topPerCluster = 4,
): ClusterLabel[] {
  const buckets = Array.from({ length: k }, () => new Map<string, number>());
  const sizes = new Array<number>(k).fill(0);

  for (let i = 0; i < assignments.length; i += 1) {
    const cluster = assignments[i]!;
    sizes[cluster] += 1;
    const freq = buckets[cluster]!;
    const seen = new Set<string>();
    for (const t of tokenBags[i] ?? []) {
      if (t.length < 2 || stopwords.has(t) || isNoiseKeyword(t) || seen.has(t)) continue;
      seen.add(t);
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
  }

  const out: ClusterLabel[] = [];
  for (let c = 0; c < k; c += 1) {
    if (sizes[c]! < 2) continue;
    const terms = [...(buckets[c]?.entries() ?? [])]
      .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
      .slice(0, topPerCluster)
      .map(([term]) => term);
    if (terms.length === 0) continue;
    out.push({ terms, size: sizes[c]! });
  }

  return out.sort((a, b) => b.size - a.size);
}
