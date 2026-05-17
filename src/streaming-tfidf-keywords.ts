/**
 * 스트리밍 BM25 + 인접 2-gram (Kiwi/휴리스틱 토큰)
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
const BM25_K1 = 1.2;
const BM25_B = 0.75;

export { adaptiveMinCount, type KeywordExtractOptions, type KeywordRankItem };

function adaptiveBigramMinDf(messageCount: number, unigramMinDf: number): number {
  if (messageCount < 500) return Math.max(2, unigramMinDf - 1);
  if (messageCount < 10_000) return Math.max(3, unigramMinDf);
  const scaled = Math.floor(Math.sqrt(messageCount) / 30);
  return Math.max(unigramMinDf + 2, scaled, 4);
}

function canBigramPair(a: string, b: string): boolean {
  if (a.length < 2 || b.length < 2) return false;
  if (a.length + b.length > 28) return false;
  if (/^\d+$/.test(a) || /^\d+$/.test(b)) return false;
  return true;
}

/** Okapi BM25 (집계 tf·df·코퍼스 평균 길이) */
export function bm25Score(tf: number, df: number, corpusMessages: number, avgDl: number): number {
  const N = Math.max(corpusMessages, 1);
  const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
  const dl = Math.max(1, tf / Math.max(df, 1));
  const denom = tf + BM25_K1 * (1 - BM25_B + (BM25_B * dl) / Math.max(avgDl, 1));
  const tfNorm = (tf * (BM25_K1 + 1)) / denom;
  return idf * tfNorm;
}

function minPmiThreshold(corpusMessages: number): number {
  if (corpusMessages < 500) return 3;
  if (corpusMessages < 10_000) return 3.5;
  return 4;
}

function isStutterBigram(label: string): boolean {
  if (!label.includes(" ")) return false;
  const parts = label.split(" ");
  if (parts.length !== 2) return false;
  const [a, b] = parts;
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.startsWith(b) || b.startsWith(a)) {
    const shorter = a.length < b.length ? a : b;
    const longer = a.length >= b.length ? a : b;
    return longer.length - shorter.length <= 4;
  }
  if (isDiscourseBigram(a, b)) return true;
  return false;
}

function isDiscourseBigram(a: string, b: string): boolean {
  const weak = new Set(["한데", "그래도", "아니면", "아니고", "있어서", "쓰고", "쓰면"]);
  return weak.has(a) || weak.has(b);
}

function pmiMultiplier(
  label: string,
  df: number,
  N: number,
  docFreq: Map<string, number>,
): number {
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
  const minPmi = minPmiThreshold(N);
  if (pmi < minPmi) return 1;
  return 1 + Math.min(0.4, (pmi - minPmi) * 0.05);
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
  if (isStutterBigram(label)) return false;
  if (label.includes(" ")) {
    for (const part of label.split(" ")) {
      if (stop?.has(part) || isNoiseKeyword(part)) return false;
    }
  }
  return true;
}

export type KeywordTokenizeFn = (raw: string) => string[];

/** 메시지 스트림 → BM25 어절·2-gram 키워드 */
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
    this.addDocumentTokens(this.tokenize(raw));
  }

  /** Kiwi 토큰을 한 번만 계산했을 때 */
  addDocumentTokens(tokens: string[]): void {
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
    const avgDl = Math.max(1, this.totalTokenHits / N);
    const minDf = options.minDocFreq ?? adaptiveMinCount(this.documents);
    const bigramMinDf = adaptiveBigramMinDf(N, minDf);
    const stop = options.stopwords;
    const limit = options.limit ?? 100;
    const items: KeywordRankItem[] = [];

    for (const [label, df] of this.docFreq) {
      if (!passesFilters(label, df, minDf, stop)) continue;
      const tf = this.termFreq.get(label) ?? 0;
      items.push({ label, score: bm25Score(tf, df, N, avgDl), messageHits: df });
    }

    for (const [label, df] of this.bigramDf) {
      if (!passesFilters(label, df, bigramMinDf, stop)) continue;
      const tf = this.bigramTf.get(label) ?? 0;
      const base = bm25Score(tf, df, N, avgDl) * BIGRAM_SCORE_BOOST * pmiMultiplier(label, df, N, this.docFreq);
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
