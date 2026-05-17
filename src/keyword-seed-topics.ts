import type { CountItem } from "./types.js";
import type { ReportTopic } from "./types.js";
import type { TopicMapAccumulator } from "./topic-map.js";
import { isGenericTopicLead } from "./topic-generic.js";
import { isNoiseKeyword } from "./keyword-quality.js";
import { normalizeTopicTerm, normalizeTopicTerms, topicSimilarity } from "./topic-normalize.js";

const SEED_SIMILARITY_SKIP = 0.45;
const MAX_FREQ_SEEDS = 6;

function topicPercent(messageHits: number, totalMessages: number): number {
  return Math.round(Math.min(100, (messageHits / Math.max(totalMessages, 1)) * 100) * 10) / 10;
}

function expandLabelTerms(label: string): string[] {
  return label
    .split(/\s+/)
    .map((t) => normalizeTopicTerm(t.trim()))
    .filter((t) => t.length >= 2 && !isNoiseKeyword(t));
}

function buildTitle(label: string, terms: string[]): string {
  const parts = expandLabelTerms(label);
  if (parts.length >= 2) {
    const a = parts[0]!;
    const b = parts[1]!;
    if (a === b) return a;
    return `${a} · ${b}`;
  }
  const lead = parts[0] ?? normalizeTopicTerm(label);
  const sub = terms.find((t) => {
    const n = normalizeTopicTerm(t);
    return n !== lead && !isGenericTopicLead(n);
  });
  const subNorm = sub ? normalizeTopicTerm(sub) : "";
  if (subNorm && subNorm !== lead) return `${lead} · ${subNorm}`;
  return lead;
}

function isMorphVariantOfSeeded(label: string, seededNorm: Set<string>): boolean {
  const norm = normalizeTopicTerm(label);
  if (seededNorm.has(norm)) return true;
  for (const s of seededNorm) {
    if (norm.startsWith(s) && norm.length <= s.length + 2) return true;
    if (s.startsWith(norm) && s.length <= norm.length + 2) return true;
  }
  return false;
}

/** 키워드 상위(빈도·특이어) → 미니 테마 카드 */
export function buildKeywordSeedTopics(
  keywordsByFreq: CountItem[],
  keywordsDistinctive: CountItem[],
  totalMessages: number,
  topicMap?: TopicMapAccumulator | null,
): ReportTopic[] {
  if (totalMessages < 30) return [];

  const seen = new Set<string>();
  const seededNorm = new Set<string>();
  const distinctiveLabels = new Set(keywordsDistinctive.slice(0, 8).map((k) => k.label));
  const seeds: { label: string; count: number; distinctive: boolean }[] = [];

  for (const k of keywordsByFreq.slice(0, 12)) {
    if (seen.has(k.label)) continue;
    if (seeds.length >= MAX_FREQ_SEEDS && !distinctiveLabels.has(k.label)) continue;
    seen.add(k.label);
    seeds.push({ label: k.label, count: k.count, distinctive: distinctiveLabels.has(k.label) });
  }
  for (const k of keywordsDistinctive.slice(0, 8)) {
    if (seen.has(k.label)) {
      const hit = seeds.find((s) => s.label === k.label);
      if (hit) hit.distinctive = true;
      continue;
    }
    seen.add(k.label);
    seeds.push({ label: k.label, count: k.count, distinctive: true });
  }

  const topics: ReportTopic[] = [];
  for (const seed of seeds) {
    if (isGenericTopicLead(seed.label) && !seed.distinctive) continue;
    if (isMorphVariantOfSeeded(seed.label, seededNorm)) continue;

    const baseTerms = expandLabelTerms(seed.label);
    if (baseTerms.length === 0) continue;
    const neighbors = topicMap?.getCooccurrenceNeighbors(seed.label, 3) ?? [];
    const terms = normalizeTopicTerms([...baseTerms, ...neighbors]).slice(0, 8);
    if (terms.length < 1) continue;
    const pct = topicPercent(seed.count, totalMessages);
    if (pct < 0.5) continue;

    const candidate: ReportTopic = {
      id: `kw-${topics.length}`,
      kind: "theme",
      title: buildTitle(seed.label, terms),
      terms,
      messagePercent: pct,
    };

    if (topics.some((t) => topicSimilarity(t, candidate) >= SEED_SIMILARITY_SKIP)) continue;

    topics.push(candidate);
    for (const t of terms) seededNorm.add(normalizeTopicTerm(t));
    seededNorm.add(normalizeTopicTerm(seed.label));
  }

  return topics.sort((a, b) => b.messagePercent - a.messagePercent);
}
