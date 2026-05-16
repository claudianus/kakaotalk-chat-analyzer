/**
 * 스트리밍 TF-IDF + 인접 2-gram — 카톡 짧은 메시지에 맞춘 키워드 추출
 */
import { isNoiseKeyword } from "./keyword-quality.js";
import {
  adaptiveMinCount,
  type KeywordExtractOptions,
  type KeywordRankItem,
} from "./keyword-rank.js";
import { normalizeKoreanText } from "./korean-normalize.js";

const MAX_UNIGRAM_KEYS = 36_000;
const MAX_BIGRAM_KEYS = 22_000;
const PRUNE_UNIGRAM_TO = 28_000;
const PRUNE_BIGRAM_TO = 16_000;
const MAX_TOKEN_LEN = 32;
const BIGRAM_SCORE_BOOST = 1.12;

export { adaptiveMinCount, type KeywordExtractOptions, type KeywordRankItem };

function normalizeToken(token: string): string {
  return /^[A-Za-z0-9_+-]+$/.test(token) ? token.toLowerCase() : token.trim();
}

function tokenize(doc: string): string[] {
  const out: string[] = [];
  for (const raw of doc.split(/\s+/)) {
    if (!raw) continue;
    const t = normalizeToken(raw);
    if (t.length < 2 || t.length > MAX_TOKEN_LEN) continue;
    if (!/[가-힣A-Za-z]/.test(t)) continue;
    out.push(t);
  }
  return out;
}

function canBigramPair(a: string, b: string): boolean {
  if (a.length < 2 || b.length < 2) return false;
  if (a.length + b.length > 28) return false;
  if (/^\d+$/.test(a) || /^\d+$/.test(b)) return false;
  return true;
}

function tfidfScore(tf: number, df: number, corpusMessages: number): number {
  return Math.log1p(tf) * Math.log((corpusMessages + 1) / (df + 0.5));
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

/** 메시지 스트림 → TF-IDF 어절·2-gram 키워드 */
export class StreamingTfidfKeywords {
  private documents = 0;
  private readonly termFreq = new Map<string, number>();
  private readonly docFreq = new Map<string, number>();
  private readonly bigramTf = new Map<string, number>();
  private readonly bigramDf = new Map<string, number>();

  addDocument(raw: string): void {
    const doc = normalizeKoreanText(raw, { keepEnglish: true, keepNumbers: true });
    if (!doc) return;
    this.documents += 1;
    const tokens = tokenize(doc);
    if (tokens.length === 0) return;

    const seen = new Set<string>();
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
    const items: KeywordRankItem[] = [];

    for (const [label, df] of this.docFreq) {
      if (!passesFilters(label, df, minDf, stop)) continue;
      const tf = this.termFreq.get(label) ?? 0;
      items.push({ label, score: tfidfScore(tf, df, N), messageHits: df });
    }

    for (const [label, df] of this.bigramDf) {
      if (!passesFilters(label, df, bigramMinDf, stop)) continue;
      const tf = this.bigramTf.get(label) ?? 0;
      items.push({
        label,
        score: tfidfScore(tf, df, N) * BIGRAM_SCORE_BOOST,
        messageHits: df,
      });
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
