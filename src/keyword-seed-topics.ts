import type { CountItem } from "./types.js";
import type { ReportTopic } from "./types.js";
import type { TopicMapAccumulator } from "./topic-map.js";
import { isGenericTopicLead } from "./topic-generic.js";
import { isNoiseKeyword } from "./keyword-quality.js";

function topicPercent(messageHits: number, totalMessages: number): number {
  return Math.round(Math.min(100, (messageHits / Math.max(totalMessages, 1)) * 100) * 10) / 10;
}

function expandLabelTerms(label: string): string[] {
  return label
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !isNoiseKeyword(t));
}

function buildTitle(label: string, terms: string[]): string {
  const parts = expandLabelTerms(label);
  if (parts.length >= 2) return parts.slice(0, 2).join(" · ");
  const sub = terms.find((t) => t !== parts[0] && !isGenericTopicLead(t));
  const lead = parts[0] ?? label;
  return sub && sub !== lead ? `${lead} · ${sub}` : lead;
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
  const distinctiveLabels = new Set(keywordsDistinctive.slice(0, 8).map((k) => k.label));
  const seeds: { label: string; count: number; distinctive: boolean }[] = [];

  for (const k of keywordsByFreq.slice(0, 12)) {
    if (seen.has(k.label)) continue;
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
    const baseTerms = expandLabelTerms(seed.label);
    if (baseTerms.length === 0) continue;
    const neighbors = topicMap?.getCooccurrenceNeighbors(seed.label, 3) ?? [];
    const terms = [...new Set([...baseTerms, ...neighbors])].slice(0, 8);
    if (terms.length < 1) continue;
    const pct = topicPercent(seed.count, totalMessages);
    if (pct < 0.5) continue;
    topics.push({
      id: `kw-${topics.length}`,
      kind: "theme",
      title: buildTitle(seed.label, terms),
      terms,
      messagePercent: pct,
    });
  }

  return topics.sort((a, b) => b.messagePercent - a.messagePercent);
}
