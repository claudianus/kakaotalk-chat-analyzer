/**
 * 스트리밍 TF-IDF + 인접 2-gram (Kiwi/휴리스틱 토큰)
 */
import { tokenizeForKeywords } from "./keyword-tokenize.js";
import { isNoiseKeyword } from "./keyword-quality.js";
import {
  adaptiveMinCount,
  type KeywordExtractOptions,
  type KeywordRankItem,
} from "./keyword-rank.js";

const MAX_UNIGRAM_KEYS = 36_000;
const MAX_BIGRAM_KEYS = 22_000;
const PRUNE_UNIGRAM_TO = 28_000;
const PRUNE_BIGRAM_TO = 16_000;
const BIGRAM_SCORE_BOOST = 1.12;

export { adaptiveMinCount, type KeywordExtractOptions, type KeywordRankItem };

function canBigramPair(a: string, b: string): boolean {
  if (a.length < 2 || b.length < 2) return false;
  if (a.length + b.length > 28) return false;
  if (/^\d+$/.test(a) || /^\d+$/.test(b)) return false;
  return true;
}

function bm25Score(tf: number, df: number, corpusMessages: number, avgDocLen: number): number {
  const k1 = 1.25;
  const b = 0.72;
  const dl = Math.max(1, tf);
  const avg = Math.max(1, avgDocLen);
  const idf = Math.log(1 + (corpusMessages - df + 0.5) / (df + 0.5));
  const numer = tf * (k1 + 1);
  const denom = tf + k1 * (1 - b + (b * dl) / avg);
  return Math.max(0, idf * (numer / denom));
}

function pmiMultiplier(label: string, df: number, N: number, docFreq: Map<string, number>): number {
  if (!label.includes(" ")) return 1;
  const parts = label.split(" ");
  if (parts.length !== 2) return 1;
  const [a, b] = parts;
  const dfA = docFreq.get(a!) ?? 0;
  const dfB = docFreq.get(b!) ?? 0;
  if (dfA < 2 || dfB < 2 || df < 2) return 1;
  const pAb = df / N;
  const pA = dfA / N;
  const pB = dfB / N;
  const pmi = Math.log2(pAb / (pA * pB) + 1e-12);
  if (pmi < 4) return 1;
  return 1 + Math.min(0.4, (pmi - 4) * 0.05);
}

function passesFilters(
  label: string,
  df: number,
  minDf: number,
  stop: ReadonlySet<string> | undefined,
): boolean {
  if (df < minDf) return false;
  if (stop?.has(label)) return false;
  if (isNoiseKeyword(label)) return false;
  if (label.includes(" ")) {
    for (const part of label.split(" ")) {
      if (stop?.has(part) || isNoiseKeyword(part)) return false;
    }
  }
  return true;
}

export type KeywordTokenizeFn = (raw: string) => string[];

/** 메시지 스트림 → TF-IDF 어절·2-gram 키워드 */
export class StreamingTfidfKeywords {
  private readonly tokenize: KeywordTokenizeFn;
  private documents = 0;
  private readonly termFreq = new Map<string, number>();
  private readonly docFreq = new Map<string, number>();
  private readonly bigramTf = new Map<string, number>();
  private readonly bigramDf = new Map<string, number>();
  private totalTokenHits = 0;

  constructor(tokenize: KeywordTokenizeFn = tokenizeForKeywords) {
    this.tokenize = tokenize;
  }

  addDocument(raw: string): void {
    const tokens = this.tokenize(raw);
    if (tokens.length === 0) return;
    this.documents += 1;

    const seen = new Set<string>();
    this.totalTokenHits += tokens.length;
    for (const t of tokens) {
      this.termFreq.set(t, (this.termFreq.get(t) ?? 0) + 1);
      if (!seen.has(t)) {
        this.docFreq.set(t, (this.docFreq.get(t) ?? 0) + 1);
        seen.add(t);
      }
    }

    const seenBg = new Set<string>();
    for (let i = 0; i < tokens.length - 1; i += 1) {
      const a = tokens[i]!;
      const b = tokens[i + 1]!;
      if (!canBigramPair(a, b)) continue;
      const bg = `${a} ${b}`;
      this.bigramTf.set(bg, (this.bigramTf.get(bg) ?? 0) + 1);
      if (!seenBg.has(bg)) {
        this.bigramDf.set(bg, (this.bigramDf.get(bg) ?? 0) + 1);
        seenBg.add(bg);
      }
    }

    if (this.docFreq.size > MAX_UNIGRAM_KEYS) this.prunePair(this.docFreq, this.termFreq, PRUNE_UNIGRAM_TO);
    if (this.bigramDf.size > MAX_BIGRAM_KEYS) this.prunePair(this.bigramDf, this.bigramTf, PRUNE_BIGRAM_TO);
  }

  extractKeywordItems(options: KeywordExtractOptions = {}): KeywordRankItem[] {
    const N = Math.max(this.documents, 1);
    const minDf = options.minDocFreq ?? adaptiveMinCount(this.documents);
    const bigramMinDf = Math.max(2, minDf - 1);
    const stop = options.stopwords;
    const limit = options.limit ?? 100;
    const avgDocLen = this.totalTokenHits / N;
    const items: KeywordRankItem[] = [];

    for (const [label, df] of this.docFreq) {
      if (!passesFilters(label, df, minDf, stop)) continue;
      const tf = this.termFreq.get(label) ?? 0;
      items.push({ label, score: bm25Score(tf, df, N, avgDocLen), messageHits: df });
    }

    for (const [label, df] of this.bigramDf) {
      if (!passesFilters(label, df, bigramMinDf, stop)) continue;
      const tf = this.bigramTf.get(label) ?? 0;
      const base = bm25Score(tf, df, N, avgDocLen) * BIGRAM_SCORE_BOOST * pmiMultiplier(label, df, N, this.docFreq);
      items.push({ label, score: base, messageHits: df });
    }

    return items
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.messageHits - a.messageHits ||
          b.label.length - a.label.length ||
          a.label.localeCompare(b.label),
      )
      .slice(0, limit);
  }

  private prunePair(dfMap: Map<string, number>, tfMap: Map<string, number>, keep: number): void {
    const kept = [...dfMap.entries()]
      .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
      .slice(0, keep);
    const keptSet = new Set(kept.map(([k]) => k));
    dfMap.clear();
    for (const [k, v] of kept) dfMap.set(k, v);
    for (const k of [...tfMap.keys()]) {
      if (!keptSet.has(k)) tfMap.delete(k);
    }
  }
}
