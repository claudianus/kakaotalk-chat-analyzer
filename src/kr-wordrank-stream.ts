/**
 * KR-WordRank (Kim et al. 2014) 스트리밍 포팅
 * @see https://github.com/lovit/KR-WordRank
 * @see https://lovit.github.io/nlp/2018/04/16/krwordrank/
 */
import { isNoiseKeyword } from "./keyword-quality.js";
import { normalizeKoreanText } from "./korean-normalize.js";

export type SubwordPos = "L" | "R";
export type SubwordToken = readonly [word: string, pos: SubwordPos];

export interface KrWordRankOptions {
  minCount?: number;
  maxLength?: number;
  beta?: number;
  maxIter?: number;
  numRset?: number;
  converge?: number;
}

export interface KrWordRankExtractOptions {
  stopwords?: ReadonlySet<string>;
  limit?: number;
}

export interface KeywordRankItem {
  label: string;
  /** HITS 점수 (상대 중요도) */
  score: number;
  /** 해당 단어가 등장한 메시지 수(문서 빈도) */
  messageHits: number;
}

const DEFAULT_MIN_COUNT = 4;
const DEFAULT_MAX_LENGTH = 10;
const MAX_VOCAB = 48_000;
const MAX_EDGE_KEYS = 280_000;

function tokenKey(t: SubwordToken): string {
  return `${t[1]}:${t[0]}`;
}

function parseTokenKey(key: string): SubwordToken {
  const i = key.indexOf(":");
  return [key.slice(i + 1), key.charAt(0) as SubwordPos];
}

/** 메시지 스트림으로 학습 → HITS → L-부분 키워드 */
export class KrWordRankStream {
  private minCount: number;
  private readonly maxLength: number;
  private readonly beta: number;
  private readonly maxIter: number;
  private readonly numRset: number;
  private readonly converge: number;

  private readonly counter = new Map<string, number>();
  private readonly edgeCounts = new Map<string, number>();
  /** 공백 단위 어절이 포함된 메시지 수 */
  private readonly wordDocFreq = new Map<string, number>();
  private documents = 0;

  constructor(options: KrWordRankOptions = {}) {
    this.minCount = options.minCount ?? DEFAULT_MIN_COUNT;
    this.maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
    this.beta = options.beta ?? 0.85;
    this.maxIter = options.maxIter ?? 12;
    this.numRset = options.numRset ?? 280;
    this.converge = options.converge ?? 0.001;
  }

  addDocument(raw: string): void {
    const doc = normalizeKoreanText(raw, { keepEnglish: true, keepNumbers: true });
    if (!doc) return;
    this.documents += 1;
    const tokens = doc.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return;

    const seenWord = new Set<string>();
    for (const token of tokens) {
      if (token.length >= 2 && !seenWord.has(token)) {
        seenWord.add(token);
        this.wordDocFreq.set(token, (this.wordDocFreq.get(token) ?? 0) + 1);
      }
      this.scanToken(token);
    }

    const links: Array<[SubwordToken, SubwordToken]> = [];
    for (const token of tokens) {
      links.push(...intraLinks(token, this.maxLength));
    }
    if (tokens.length > 1) {
      const padded = [tokens[tokens.length - 1]!, ...tokens, tokens[0]!];
      links.push(...interLinks(padded, this.maxLength));
    }
    for (const [a, b] of links) {
      this.bumpEdge(a, b);
    }
  }

  extractKeywords(options: KrWordRankExtractOptions = {}): Map<string, number> {
    const vocab = this.buildVocabulary();
    if (vocab.index2token.length < 2) return new Map();

    const graph = this.buildGraph(vocab);
    const rank = runHits(graph, {
      beta: this.beta,
      maxIter: this.maxIter,
      converge: this.converge,
      nodeCount: vocab.index2token.length,
    });

    const lset = new Map<string, number>();
    const rset = new Map<string, number>();
    for (const [idx, score] of rank) {
      const tok = vocab.index2token[idx];
      if (!tok) continue;
      const [word, pos] = tok;
      if (pos === "L") lset.set(word, score);
      else rset.set(word, score);
    }

    let rsetUse = rset;
    if (this.numRset > 0 && rset.size > this.numRset) {
      rsetUse = new Map(
        [...rset.entries()].sort((a, b) => b[1] - a[1]).slice(0, this.numRset),
      );
    }

    let keywords = selectKeywords(lset, rsetUse);
    keywords = filterCompounds(keywords);
    keywords = filterSubtokens(keywords);

    const stop = options.stopwords;
    const limit = options.limit ?? 100;
    const out = new Map<string, number>();
    for (const [word, score] of [...keywords.entries()].sort((a, b) => b[1] - a[1])) {
      if (stop?.has(word)) continue;
      if (isNoiseKeyword(word)) continue;
      if (word.length < 2) continue;
      out.set(word, score);
      if (out.size >= limit) break;
    }
    return out;
  }

  extractKeywordItems(options: KrWordRankExtractOptions = {}): KeywordRankItem[] {
    const scores = this.extractKeywords(options);
    return [...scores.entries()]
      .map(([label, score]) => ({
        label,
        score,
        messageHits: this.wordDocFreq.get(label) ?? 0,
      }))
      .sort((a, b) => b.score - a.score || b.messageHits - a.messageHits);
  }

  private scanToken(token: string): void {
    const len = token.length;
    this.bumpCounter([token, "L"]);
    for (let e = 1; e < Math.min(len, this.maxLength); e += 1) {
      if (len - e > this.maxLength) continue;
      this.bumpCounter([token.slice(0, e), "L"]);
      this.bumpCounter([token.slice(e), "R"]);
    }
  }

  private bumpCounter(token: SubwordToken): void {
    const k = tokenKey(token);
    this.counter.set(k, (this.counter.get(k) ?? 0) + 1);
    if (this.counter.size > MAX_VOCAB * 3) this.pruneCounter();
  }

  private pruneCounter(): void {
    const kept = [...this.counter.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_VOCAB);
    this.counter.clear();
    for (const [k, v] of kept) this.counter.set(k, v);
  }

  private bumpEdge(a: SubwordToken, b: SubwordToken): void {
    if (this.edgeCounts.size > MAX_EDGE_KEYS) return;
    const k = `${tokenKey(a)}>>${tokenKey(b)}`;
    this.edgeCounts.set(k, (this.edgeCounts.get(k) ?? 0) + 1);
  }

  private buildVocabulary(): { token2idx: Map<string, number>; index2token: SubwordToken[] } {
    let entries = [...this.counter.entries()].filter(([, c]) => c >= this.minCount);
    entries = pruneDominatedSubwords(entries);
    entries.sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
    entries = entries.slice(0, MAX_VOCAB);

    const token2idx = new Map<string, number>();
    const index2token: SubwordToken[] = [];
    for (const [k] of entries) {
      token2idx.set(k, index2token.length);
      index2token.push(parseTokenKey(k));
    }
    return { token2idx, index2token };
  }

  private buildGraph(vocab: {
    token2idx: Map<string, number>;
    index2token: SubwordToken[];
  }): Map<number, Map<number, number>> {
    const raw = new Map<number, Map<number, number>>();
    for (const [key, weight] of this.edgeCounts) {
      const sep = key.indexOf(">>");
      if (sep < 0) continue;
      const a = vocab.token2idx.get(key.slice(0, sep));
      const b = vocab.token2idx.get(key.slice(sep + 2));
      if (a === undefined || b === undefined) continue;
      let row = raw.get(a);
      if (!row) {
        row = new Map();
        raw.set(a, row);
      }
      row.set(b, (row.get(b) ?? 0) + weight);
      let rowB = raw.get(b);
      if (!rowB) {
        rowB = new Map();
        raw.set(b, rowB);
      }
      rowB.set(a, (rowB.get(a) ?? 0) + weight);
    }

    const graph = new Map<number, Map<number, number>>();
    for (const [fromNode, toDict] of raw) {
      const sum = [...toDict.values()].reduce((a, c) => a + c, 0);
      if (sum <= 0) continue;
      for (const [toNode, w] of toDict) {
        let col = graph.get(toNode);
        if (!col) {
          col = new Map();
          graph.set(toNode, col);
        }
        col.set(fromNode, (col.get(fromNode) ?? 0) + w / sum);
      }
    }
    return graph;
  }
}

function intraLinks(token: string, maxLength: number): Array<[SubwordToken, SubwordToken]> {
  const out: Array<[SubwordToken, SubwordToken]> = [];
  const len = token.length;
  for (let e = 1; e < Math.min(len, 10); e += 1) {
    if (len - e > maxLength) continue;
    out.push([[token.slice(0, e), "L"], [token.slice(e), "R"]]);
  }
  return out;
}

function interLinks(tokens: string[], maxLength: number): Array<[SubwordToken, SubwordToken]> {
  const out: Array<[SubwordToken, SubwordToken]> = [];
  for (let i = 1; i < tokens.length - 1; i += 1) {
    const left = tokens[i - 1]!;
    const curr = tokens[i]!;
    const right = tokens[i + 1]!;
    for (let b = 1; b < Math.min(10, left.length); b += 1) {
      out.push([[left.slice(-b), "R"], [curr, "L"]]);
    }
    for (let e = 1; e < Math.min(10, right.length); e += 1) {
      out.push([[curr, "L"], [right.slice(0, e), "L"]]);
    }
  }
  return out;
}

function pruneDominatedSubwords(entries: Array<[string, number]>): Array<[string, number]> {
  const sorted = [...entries].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
  const kept: Array<[string, number]> = [];
  for (const [key, freq] of sorted) {
    const dominated = kept.some(([k, f]) => {
      if (f !== freq) return false;
      const posK = k.charAt(0);
      const posKey = key.charAt(0);
      if (posK !== posKey) return false;
      const s = k.slice(2);
      const t = key.slice(2);
      return s.length > t.length && s.includes(t);
    });
    if (!dominated) kept.push([key, freq]);
  }
  return kept;
}

function runHits(
  graph: Map<number, Map<number, number>>,
  opts: { beta: number; maxIter: number; converge: number; nodeCount: number },
): Map<number, number> {
  const { beta, maxIter, converge, nodeCount } = opts;
  const dw = 100 / nodeCount;
  const rank = new Map<number, number>();
  for (const node of graph.keys()) rank.set(node, dw);

  const sumWeight = 100;
  for (let iter = 1; iter <= maxIter; iter += 1) {
    const next = new Map<number, number>();
    let diff = 0;
    for (const [toNode, fromDict] of graph) {
      let s = 0;
      for (const [fromNode, w] of fromDict) {
        s += w * (rank.get(fromNode) ?? dw);
      }
      const updated = beta * s + (1 - beta) * dw;
      next.set(toNode, updated);
      diff += Math.abs(updated - (rank.get(toNode) ?? 0));
    }
    for (const [n, v] of next) rank.set(n, v);
    if (diff < sumWeight * converge) break;
  }
  return rank;
}

function selectKeywords(lset: Map<string, number>, rset: Map<string, number>): Map<string, number> {
  const keywords = new Map<string, number>();
  for (const [word, r] of [...lset.entries()].sort((a, b) => b[1] - a[1])) {
    if (word.length === 1) continue;
    let compound = false;
    for (let e = 2; e < word.length; e += 1) {
      if (keywords.has(word.slice(0, e)) && rset.has(word.slice(0, e))) {
        compound = true;
        break;
      }
    }
    if (!compound) keywords.set(word, r);
  }
  return keywords;
}

function filterCompounds(keywords: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [word, r] of [...keywords.entries()].sort((a, b) => b[1] - a[1])) {
    const len = word.length;
    if (len <= 2) {
      out.set(word, r);
      continue;
    }
    if (len === 3 && out.has(word.slice(0, 2))) continue;
    let compound = false;
    for (let e = 2; e < len; e += 1) {
      if (keywords.has(word.slice(0, e)) && keywords.has(word.slice(e))) {
        compound = true;
        break;
      }
    }
    if (!compound) out.set(word, r);
  }
  return out;
}

function filterSubtokens(keywords: Map<string, number>): Map<string, number> {
  const subtokens = new Set<string>();
  const out = new Map<string, number>();
  for (const [word, r] of [...keywords.entries()].sort((a, b) => b[1] - a[1])) {
    const subs = new Set<string>();
    for (let e = 2; e <= word.length; e += 1) subs.add(word.slice(0, e));
    let isSub = false;
    for (const sub of subs) {
      if (subtokens.has(sub)) {
        isSub = true;
        break;
      }
    }
    if (!isSub) {
      out.set(word, r);
      for (const sub of subs) subtokens.add(sub);
    }
  }
  return out;
}

/** 메시지 수에 따른 min_count (소규모 방 완화) */
export function adaptiveMinCount(messageCount: number): number {
  if (messageCount < 200) return 2;
  if (messageCount < 2_000) return 3;
  if (messageCount < 20_000) return 4;
  return 5;
}
