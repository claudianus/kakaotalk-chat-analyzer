import { topicDisplayMax, topicMinThemesLargeCorpus } from "./report-config.js";
import { isGenericTopicLead, themeLeadPenalty } from "./topic-generic.js";
import type { ReportTopic } from "./types.js";

const RRF_K = 60;

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
    return `theme:${[...t.terms].sort().slice(0, 5).join("\t")}`;
  }
  return `${t.kind}:${t.title.trim().toLowerCase()}`;
}

function jaccard(a: string[], b: string[]): number {
  const setB = new Set(b);
  if (a.length === 0) return 0;
  let inter = 0;
  for (const x of a) if (setB.has(x)) inter += 1;
  const union = new Set([...a, ...setB]).size;
  return union > 0 ? inter / union : 0;
}

function mergeDuplicateLeads(topics: ReportTopic[]): ReportTopic[] {
  const out: ReportTopic[] = [];
  for (const t of topics) {
    if (t.kind !== "theme") {
      out.push({ ...t });
      continue;
    }
    const hit = out.find((m) => m.kind === "theme" && jaccard(m.terms, t.terms) > 0.55);
    if (hit) {
      hit.messagePercent = Math.max(hit.messagePercent, t.messagePercent);
      hit.terms = [...new Set([...hit.terms, ...t.terms])].slice(0, 8);
      if (t.messagePercent > hit.messagePercent) hit.title = t.title;
      const lead = pickThemeTitleLead(hit);
      const sub = hit.terms.find((x) => x !== lead && !isGenericTopicLead(x));
      if (sub && !hit.title.includes(sub)) hit.title = `${lead} · ${sub}`;
    } else {
      out.push({ ...t });
    }
  }
  return out;
}

function pickThemeTitleLead(t: ReportTopic): string {
  return t.title.split(" · ")[0]?.trim() ?? t.terms[0] ?? t.title;
}

function demoteWeakOverlap(themes: ReportTopic[]): ReportTopic[] {
  const sorted = [...themes];
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      if (jaccard(sorted[i]!.terms, sorted[j]!.terms) > 0.72) {
        if (sorted[i]!.messagePercent >= sorted[j]!.messagePercent) {
          sorted[j]!.messagePercent *= 0.85;
        } else {
          sorted[i]!.messagePercent *= 0.85;
        }
      }
    }
  }
  return sorted;
}

/** graph·keyword·semantic 3레인 RRF 병합 */
export function mergeTopicLanes(lanes: TopicLaneInput, totalMessages: number): ReportTopic[] {
  const maxOut = topicDisplayMax();
  const meta = new Map<
    string,
    { topic: ReportTopic; rrf: number; score: number }
  >();

  const ingest = (list: ReportTopic[], laneWeight: number) => {
    const themes = list.filter((t) => t.kind === "theme");
    themes.forEach((t, i) => {
      const key = topicKey(t);
      const rank = i + 1;
      const penalty = themeLeadPenalty(t.title);
      const score =
        t.messagePercent * laneWeight * penalty +
        (themes.length - i) * 0.02;
      const prev = meta.get(key);
      const rrfAdd = rrf(rank) * laneWeight;
      if (!prev) {
        meta.set(key, { topic: { ...t }, rrf: rrfAdd, score });
      } else {
        prev.rrf += rrfAdd;
        prev.score = Math.max(prev.score, score);
        prev.topic.messagePercent = Math.max(prev.topic.messagePercent, t.messagePercent);
        prev.topic.terms = [...new Set([...prev.topic.terms, ...t.terms])].slice(0, 8);
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

  themes = demoteWeakOverlap(themes);
  themes = mergeDuplicateLeads(themes);
  themes = themes
    .filter((t) => !isGenericTopicLead(t.title) || t.messagePercent >= 2)
    .sort((a, b) => b.messagePercent - a.messagePercent || b.terms.length - a.terms.length);

  const periods = lanes.graph
    .filter((t) => t.kind === "period")
    .sort((a, b) => b.messagePercent - a.messagePercent)
    .slice(0, 4);

  const minThemes =
    totalMessages >= 10_000 ? topicMinThemesLargeCorpus() : 2;
  if (themes.length < minThemes && lanes.keyword.length > 0) {
    for (const k of lanes.keyword) {
      if (themes.length >= minThemes) break;
      if (themes.some((t) => topicKey(t) === topicKey(k))) continue;
      themes.push({ ...k });
    }
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
    const terms = [...new Set([...evidence, ...(p.terms ?? [])])].slice(0, 8);
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
    if (out.some((t) => t.kind === "theme" && topicKey(t) === topicKey(proposal))) continue;
    out.unshift(proposal);
  }

  return out.slice(0, maxOut);
}
