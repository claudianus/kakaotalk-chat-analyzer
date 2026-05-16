import { classTfidfTopTerms } from "./ctfidf.js";
import { isNoiseKeyword } from "./keyword-quality.js";
import type { ReportTopic } from "./types.js";

const MAX_GRAPH_NODES = 140;
const MAX_TOPICS = 8;
const MIN_MONTH_MESSAGES = 40;
const COOC_WINDOW = 4;

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}\t${b}` : `${b}\t${a}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  if (!y || !m) return ym;
  return `${y}년 ${Number(m)}월`;
}

/** 스트리밍 주제 맵: 공기 그래프 군집 + 월별 c-TF-IDF */
export class TopicMapAccumulator {
  private readonly cooc = new Map<string, number>();
  private readonly tokenDocFreq = new Map<string, number>();
  private readonly monthlyTf = new Map<string, Map<string, number>>();
  private readonly monthlyMessages = new Map<string, number>();
  private messages = 0;

  addMessage(tokens: string[], monthKey: string): void {
    const filtered = tokens.filter((t) => t.length >= 2 && !isNoiseKeyword(t));
    if (filtered.length === 0) return;

    this.messages += 1;
    const seen = new Set<string>();
    for (const t of filtered) {
      if (!seen.has(t)) {
        this.tokenDocFreq.set(t, (this.tokenDocFreq.get(t) ?? 0) + 1);
        seen.add(t);
      }
    }

    let monthMap = this.monthlyTf.get(monthKey);
    if (!monthMap) {
      monthMap = new Map();
      this.monthlyTf.set(monthKey, monthMap);
    }
    this.monthlyMessages.set(monthKey, (this.monthlyMessages.get(monthKey) ?? 0) + 1);
    for (const t of filtered) {
      monthMap.set(t, (monthMap.get(t) ?? 0) + 1);
    }

    const uniq = [...seen];
    for (let i = 0; i < uniq.length; i += 1) {
      for (let j = i + 1; j < uniq.length && j < i + COOC_WINDOW; j += 1) {
        const k = edgeKey(uniq[i]!, uniq[j]!);
        this.cooc.set(k, (this.cooc.get(k) ?? 0) + 1);
      }
    }
  }

  buildTopics(totalMessages: number, stopwords: ReadonlySet<string>): ReportTopic[] {
    if (this.messages < 30) return [];

    const themes = this.buildCooccurrenceThemes(totalMessages, stopwords);
    const periods = this.buildMonthlyPeriods(totalMessages, stopwords);

    const merged = [...themes, ...periods]
      .sort((a, b) => b.messagePercent - a.messagePercent || b.terms.length - a.terms.length)
      .slice(0, MAX_TOPICS);

    return merged;
  }

  private buildCooccurrenceThemes(totalMessages: number, stopwords: ReadonlySet<string>): ReportTopic[] {
    const nodes = [...this.tokenDocFreq.entries()]
      .filter(([t]) => !stopwords.has(t) && !isNoiseKeyword(t))
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_GRAPH_NODES)
      .map(([t]) => t);

    if (nodes.length < 4) return [];

    const nodeSet = new Set(nodes);
    const neighbors = new Map<string, Map<string, number>>();
    for (const term of nodes) neighbors.set(term, new Map());

    for (const [key, weight] of this.cooc) {
      const [a, b] = key.split("\t");
      if (!a || !b || !nodeSet.has(a) || !nodeSet.has(b)) continue;
      neighbors.get(a)!.set(b, weight);
      neighbors.get(b)!.set(a, weight);
    }

    const assigned = new Set<string>();
    const communities: string[][] = [];

    for (const seed of nodes) {
      if (assigned.has(seed)) continue;
      const community: string[] = [];
      const queue = [seed];
      assigned.add(seed);
      while (queue.length > 0) {
        const cur = queue.shift()!;
        community.push(cur);
        const adj = [...(neighbors.get(cur)?.entries() ?? [])].sort((a, b) => b[1] - a[1]);
        for (const [next, w] of adj.slice(0, 12)) {
          if (assigned.has(next) || w < 2) continue;
          assigned.add(next);
          queue.push(next);
        }
        if (community.length >= 18) break;
      }
      if (community.length >= 2) communities.push(community);
      if (communities.length >= 6) break;
    }

    const classTf = new Map<string, Map<string, number>>();
    communities.forEach((terms, i) => {
      const bag = new Map<string, number>();
      for (const t of terms) {
        bag.set(t, this.tokenDocFreq.get(t) ?? 1);
      }
      classTf.set(`theme-${i}`, bag);
    });

    const ranked = classTfidfTopTerms(classTf, 6);
    const topics: ReportTopic[] = [];

    for (const [classId, termScores] of ranked) {
      const terms = termScores.map((x) => x.term).filter((t) => !stopwords.has(t));
      if (terms.length < 2) continue;
      const idx = Number(classId.replace("theme-", ""));
      const community = communities[idx] ?? terms;
      let msgHits = 0;
      for (const t of community) msgHits += this.tokenDocFreq.get(t) ?? 0;
      const messagePercent = Math.round(Math.min(100, (msgHits / Math.max(totalMessages, 1)) * 100) * 10) / 10;
      topics.push({
        id: classId,
        kind: "theme",
        title: terms.slice(0, 3).join(" · "),
        terms: terms.slice(0, 8),
        messagePercent,
      });
    }

    return topics.sort((a, b) => b.messagePercent - a.messagePercent);
  }

  private buildMonthlyPeriods(totalMessages: number, stopwords: ReadonlySet<string>): ReportTopic[] {
    const eligible = [...this.monthlyMessages.entries()]
      .filter(([, c]) => c >= MIN_MONTH_MESSAGES)
      .sort((a, b) => b[1] - a[1]);

    if (eligible.length === 0) return [];

    const classTf = new Map<string, Map<string, number>>();
    for (const [ym] of eligible) {
      const raw = this.monthlyTf.get(ym);
      if (!raw) continue;
      const bag = new Map<string, number>();
      for (const [term, c] of raw) {
        if (stopwords.has(term) || isNoiseKeyword(term)) continue;
        bag.set(term, c);
      }
      if (bag.size > 0) classTf.set(ym, bag);
    }

    const ranked = classTfidfTopTerms(classTf, 6);
    const topics: ReportTopic[] = [];

    for (const [ym, termScores] of ranked) {
      const terms = termScores.map((x) => x.term);
      if (terms.length < 2) continue;
      const monthMsgs = this.monthlyMessages.get(ym) ?? 0;
      const messagePercent = Math.round((monthMsgs / Math.max(totalMessages, 1)) * 1000) / 10;
      topics.push({
        id: `month-${ym}`,
        kind: "period",
        title: monthLabel(ym),
        terms: terms.slice(0, 8),
        messagePercent,
        periodLabel: monthLabel(ym),
      });
    }

    return topics.slice(0, 4);
  }
}
