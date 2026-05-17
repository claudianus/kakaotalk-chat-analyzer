import { topicDisplayMax, topicMinThemesLargeCorpus } from "./report-config.js";
import { isGenericTopicLead, themeLeadPenalty } from "./topic-generic.js";
import {
  normalizeTopicTerm,
  normalizeTopicTerms,
  topicPairKey,
  topicSimilarity,
  normalizedTermsKey,
} from "./topic-normalize.js";
import type { ReportTopic } from "./types.js";

const RRF_K = 60;
const MERGE_SIMILARITY = 0.42;
const DROP_SIMILARITY = 0.55;

export interface TopicLaneInput {
  graph: ReportTopic[];
  keyword: ReportTopic[];
  semantic: ReportTopic[];
}

function rrf(rank: number): number {
  return 1 / (RRF_K + rank);
}

function topicKey(t: ReportTopic): string {
  if (t.kind === "theme" && t.terms.length > 0) {
    const pair = topicPairKey(t.title);
    const terms = normalizedTermsKey(t.terms);
    return `theme:${pair}|${terms}`;
  }
  return `${t.kind}:${t.title.trim().toLowerCase()}`;
}

function mergeTwoThemes(keep: ReportTopic, other: ReportTopic): ReportTopic {
  const terms = normalizeTopicTerms([...keep.terms, ...other.terms]).slice(0, 8);
  const messagePercent = Math.max(keep.messagePercent, other.messagePercent);
  const lead =
    keep.messagePercent >= other.messagePercent
      ? normalizeTopicTerm(keep.title.split(/\s*·\s*/)[0] ?? keep.terms[0] ?? "")
      : normalizeTopicTerm(other.title.split(/\s*·\s*/)[0] ?? other.terms[0] ?? "");
  const sub = terms.find((t) => t !== lead && !isGenericTopicLead(t));
  const title = sub && sub !== lead ? `${lead} · ${sub}` : lead;
  return { ...keep, title, terms, messagePercent };
}

/** 유사 테마 클러스터 병합 (전이적) */
function clusterSimilarThemes(topics: ReportTopic[]): ReportTopic[] {
  const themes = topics.filter((t) => t.kind === "theme").map((t) => ({ ...t }));
  const rest = topics.filter((t) => t.kind !== "theme");

  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < themes.length; i += 1) {
      for (let j = i + 1; j < themes.length; j += 1) {
        const a = themes[i]!;
        const b = themes[j]!;
        if (topicSimilarity(a, b) < MERGE_SIMILARITY) continue;
        const primary = a.messagePercent >= b.messagePercent ? a : b;
        const secondary = primary === a ? b : a;
        themes[i] = mergeTwoThemes(primary, secondary);
        themes.splice(j, 1);
        changed = true;
        break outer;
      }
    }
  }

  return [...themes, ...rest];
}

/** RRF·비율 낮은 쪽 제거 */
function dropRedundantThemes(themes: ReportTopic[]): ReportTopic[] {
  const out = themes.map((t) => ({ ...t }));
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < out.length; i += 1) {
      for (let j = i + 1; j < out.length; j += 1) {
        if (topicSimilarity(out[i]!, out[j]!) < DROP_SIMILARITY) continue;
        const dropIdx =
          out[i]!.messagePercent >= out[j]!.messagePercent ? j : i;
        out.splice(dropIdx, 1);
        changed = true;
        break outer;
      }
    }
  }
  return out;
}

function themeAnchorLead(t: ReportTopic): string {
  return normalizeTopicTerm(t.title.split(/\s*·\s*/)[0] ?? t.terms[0] ?? "");
}

/** 동일 lead 과다 시 상위 2장만 유지 (대용량) */
function collapseDominantAnchor(themes: ReportTopic[], totalMessages: number): ReportTopic[] {
  if (totalMessages < 10_000) return themes;
  const byLead = new Map<string, ReportTopic[]>();
  for (const t of themes) {
    if (t.kind !== "theme") continue;
    const lead = themeAnchorLead(t);
    if (!lead) continue;
    const list = byLead.get(lead) ?? [];
    list.push(t);
    byLead.set(lead, list);
  }

  const absorbIds = new Set<string>();
  for (const [, group] of byLead) {
    if (group.length <= 3) continue;
    group.sort((a, b) => b.messagePercent - a.messagePercent || b.terms.length - a.terms.length);
    const keeper = group[0]!;
    const second = group[1];
    for (let k = 2; k < group.length; k += 1) {
      const merged = mergeTwoThemes(keeper, group[k]!);
      keeper.title = merged.title;
      keeper.terms = merged.terms;
      keeper.messagePercent = merged.messagePercent;
      absorbIds.add(group[k]!.id);
    }
    if (second && topicSimilarity(keeper, second) >= MERGE_SIMILARITY) {
      const merged = mergeTwoThemes(keeper, second);
      keeper.title = merged.title;
      keeper.terms = merged.terms;
      keeper.messagePercent = merged.messagePercent;
      absorbIds.add(second.id);
    }
  }

  return themes.filter((t) => !absorbIds.has(t.id));
}

/** graph·keyword·semantic 3레인 RRF 병합 */
export function mergeTopicLanes(lanes: TopicLaneInput, totalMessages: number): ReportTopic[] {
  const maxOut = topicDisplayMax();
  const meta = new Map<string, { topic: ReportTopic; rrf: number; score: number }>();

  const ingest = (list: ReportTopic[], laneWeight: number) => {
    const themes = list.filter((t) => t.kind === "theme");
    themes.forEach((t, i) => {
      const key = topicKey(t);
      const rank = i + 1;
      const penalty = themeLeadPenalty(t.title);
      const score = t.messagePercent * laneWeight * penalty + (themes.length - i) * 0.02;
      const prev = meta.get(key);
      const rrfAdd = rrf(rank) * laneWeight;
      if (!prev) {
        meta.set(key, { topic: { ...t }, rrf: rrfAdd, score });
      } else {
        prev.rrf += rrfAdd;
        prev.score = Math.max(prev.score, score);
        prev.topic.messagePercent = Math.max(prev.topic.messagePercent, t.messagePercent);
        prev.topic.terms = normalizeTopicTerms([...prev.topic.terms, ...t.terms]).slice(0, 8);
      }
    });
  };

  ingest(lanes.graph, 1);
  ingest(lanes.keyword, 1.15);
  ingest(lanes.semantic, 1.05);

  let themes = [...meta.values()]
    .sort(
      (a, b) =>
        b.rrf - a.rrf ||
        b.score - a.score ||
        b.topic.messagePercent - a.topic.messagePercent,
    )
    .map((x) => x.topic);

  themes = dropRedundantThemes(themes);
  themes = clusterSimilarThemes(themes);
  themes = collapseDominantAnchor(themes, totalMessages);
  themes = themes
    .filter((t) => t.kind !== "theme" || !isGenericTopicLead(t.title) || t.messagePercent >= 2)
    .sort((a, b) => b.messagePercent - a.messagePercent || b.terms.length - a.terms.length);

  const periods = lanes.graph
    .filter((t) => t.kind === "period")
    .sort((a, b) => b.messagePercent - a.messagePercent)
    .slice(0, 4);

  const minThemes = totalMessages >= 10_000 ? topicMinThemesLargeCorpus() : 2;
  if (themes.length < minThemes && lanes.keyword.length > 0) {
    for (const k of lanes.keyword) {
      if (themes.length >= minThemes) break;
      if (themes.some((t) => topicSimilarity(t, k) >= MERGE_SIMILARITY)) continue;
      themes.push({ ...k });
    }
    themes = clusterSimilarThemes(themes);
    themes.sort((a, b) => b.messagePercent - a.messagePercent);
  }

  const themeCap = Math.max(maxOut - periods.length, 6);
  return [...themes.slice(0, themeCap), ...periods].slice(0, maxOut);
}

export interface LlmTopicProposal {
  title: string;
  terms?: string[];
  keywordEvidence?: string[];
}

/** LLM 제안 주제 — keywordEvidence가 키워드 집합에 있을 때만 추가 */
export function mergeTopicProposals(
  topics: ReportTopic[],
  proposals: LlmTopicProposal[] | undefined,
  keywords: { label: string; count: number }[],
  totalMessages: number,
): ReportTopic[] {
  if (!proposals?.length) return topics;
  const kwMap = new Map(keywords.map((k) => [k.label, k.count]));
  const out = topics.map((t) => ({ ...t }));
  const maxOut = topicDisplayMax();

  for (const p of proposals) {
    const evidence = (p.keywordEvidence ?? p.terms ?? []).filter((e) => e.trim().length > 0);
    if (!evidence.some((e) => kwMap.has(e))) continue;
    const terms = normalizeTopicTerms([...evidence, ...(p.terms ?? [])]).slice(0, 8);
    if (terms.length < 2) continue;
    const title = (p.title?.trim() || terms.slice(0, 2).join(" · ")).slice(0, 48);
    const maxCount = Math.max(0, ...evidence.map((e) => kwMap.get(e) ?? 0));
    const pct = Math.round(Math.min(100, (maxCount / Math.max(totalMessages, 1)) * 100) * 10) / 10;
    const proposal: ReportTopic = {
      id: `llm-${out.length}`,
      kind: "theme",
      title,
      terms,
      messagePercent: Math.max(pct, 1.2),
    };
    if (out.some((t) => topicSimilarity(t, proposal) >= MERGE_SIMILARITY)) continue;
    out.unshift(proposal);
  }

  return clusterSimilarThemes(out).slice(0, maxOut);
}
