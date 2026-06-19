import type { LlmCharacterCard, ParticipantStat, ReportData } from "./types.js";
import { isAiSlopText } from "./llm-slop.js";
import { formatNumber } from "./report-util.js";

const TOP_CHARACTER_COUNT = 10;

type Archetype = {
  id: string;
  score: (p: ParticipantStat, rank: number, avgLen: number) => number;
  tagline: (p: ParticipantStat, rank: number) => string;
};

const ARCHETYPES: Archetype[] = [
  {
    id: "anchor",
    score: (p, rank) => (rank === 0 ? 900 + p.sharePercent : 0),
    tagline: (p) => `전체의 ${p.sharePercent}% — 대화량 1위`,
  },
  {
    id: "runner-up",
    score: (p, rank) => (rank === 1 && p.sharePercent >= 8 ? 800 + p.sharePercent : 0),
    tagline: (p) => `2위 · ${p.sharePercent}%로 흐름을 받쳐 줌`,
  },
  {
    id: "bronze",
    score: (p, rank) => (rank === 2 && p.sharePercent >= 5 ? 700 + p.sharePercent : 0),
    tagline: (p, rank) => `${rank + 1}위 꾸준파 · ${formatNumber(p.messages)}건`,
  },
  {
    id: "night-owl",
    score: (p) => {
      const rate = p.nightMessages / Math.max(p.messages, 1);
      return rate >= 0.22 && p.nightMessages >= 8 ? 70 + rate * 100 + p.nightMessages * 0.2 : 0;
    },
    tagline: (p) => `심야 ${p.nightMessages}건(${Math.round((p.nightMessages / Math.max(p.messages, 1)) * 100)}%)`,
  },
  {
    id: "longform",
    score: (p, _r, avgLen) =>
      p.averageLength >= Math.max(32, avgLen * 1.35) ? 68 + p.averageLength : 0,
    tagline: (p) => `평균 ${p.averageLength}자 — 설명·정리형`,
  },
  {
    id: "linker",
    score: (p) => (p.linkMessages >= 6 ? 64 + p.linkMessages * 1.5 : 0),
    tagline: (p) => `링크 ${p.linkMessages}건 · 자료 공유`,
  },
  {
    id: "visual",
    score: (p) => (p.attachmentMessages >= 6 ? 62 + p.attachmentMessages * 1.2 : 0),
    tagline: (p) => `첨부 ${p.attachmentMessages}건 · 사진·파일`,
  },
  {
    id: "streak",
    score: (p) => (p.maxConsecutive >= 8 ? 60 + p.maxConsecutive * 2 : 0),
    tagline: (p) => `최대 ${p.maxConsecutive}연속 · 몰입형`,
  },
  {
    id: "compact",
    score: (p, _r, avgLen) =>
      p.averageLength > 0 && p.averageLength <= avgLen * 0.72 && p.messages >= 20 ? 55 + p.messages * 0.1 : 0,
    tagline: (p) => `짧은 답 ${p.averageLength}자 · 리액션형`,
  },
  {
    id: "volume",
    score: (p, rank) => (rank >= 3 && p.characters >= 3000 ? 50 + p.characters / 200 : 0),
    tagline: (p) => `총 ${formatNumber(p.characters)}자 · 장문 기여`,
  },
  {
    id: "mid-core",
    score: (p, rank) => (rank >= 3 && rank < 7 && p.sharePercent >= 3 ? 45 + p.sharePercent : 0),
    tagline: (p, rank) => `${rank + 1}위 · 중심층 ${p.sharePercent}%`,
  },
  {
    id: "regular",
    score: (p) => (p.messages >= 15 ? 30 + Math.min(p.messages, 80) * 0.15 : 0),
    tagline: (p, rank) => `${rank + 1}위 · ${formatNumber(p.messages)}건 참여`,
  },
];

function pickArchetype(
  p: ParticipantStat,
  rank: number,
  avgLen: number,
  usedIds: Set<string>,
): Archetype {
  const ranked = [...ARCHETYPES]
    .map((a) => ({ a, s: a.score(p, rank, avgLen) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s);
  const fresh = ranked.find((x) => !usedIds.has(x.a.id));
  if (fresh) return fresh.a;
  const spare = ARCHETYPES.find((a) => !usedIds.has(a.id));
  return spare ?? ARCHETYPES[ARCHETYPES.length - 1]!;
}

function distinctiveStatHook(p: ParticipantStat, rank: number, used: Set<string>): string {
  const nightPct = Math.round((p.nightMessages / Math.max(p.messages, 1)) * 100);
  const options = [
    `${formatNumber(p.messages)}건 · ${p.sharePercent}% · ${rank + 1}위`,
    `평균 ${p.averageLength}자 · ${formatNumber(p.messages)}건`,
    p.linkMessages > 0 ? `링크 ${p.linkMessages} · ${p.sharePercent}%` : "",
    p.attachmentMessages > 0 ? `첨부 ${p.attachmentMessages} · ${p.sharePercent}%` : "",
    p.nightMessages > 0 ? `심야 ${nightPct}% · ${p.nightMessages}건` : "",
    p.maxConsecutive >= 5 ? `연속 ${p.maxConsecutive} · ${formatNumber(p.messages)}건` : "",
    `글자 ${formatNumber(p.characters)} · ${p.sharePercent}%`,
  ].filter((s) => s.length > 0);
  for (const opt of options) {
    if (!used.has(opt)) {
      used.add(opt);
      return opt;
    }
  }
  return options[0] ?? `${formatNumber(p.messages)}건`;
}

function sanitizeLlmLine(value: string | undefined, used: Set<string>): string | null {
  const v = value?.trim();
  if (!v || v.length < 4) return null;
  if (isAiSlopText(v)) return null;
  const norm = v.toLowerCase();
  if (used.has(norm)) return null;
  used.add(norm);
  return v;
}

/** 메시지 상위 10명 — 역할 중복 없이 통계 기반 tagline, LLM은 슬롭·중복 제거 후 보강 */
export function resolveCharacterCards(data: ReportData): LlmCharacterCard[] {
  const top = data.participants.slice(0, TOP_CHARACTER_COUNT);
  if (top.length === 0) return [];
  const avgLen =
    top.reduce((sum, p) => sum + p.averageLength, 0) / Math.max(top.length, 1);
  const llmByAlias = new Map(
    (data.llmInsights?.characterCards ?? []).map((c) => [c.alias, c] as const),
  );
  const usedArchetypes = new Set<string>();
  const usedTaglines = new Set<string>();
  const usedStatHooks = new Set<string>();

  return top.map((p, rank) => {
    const llm = llmByAlias.get(p.alias);
    const archetype = pickArchetype(p, rank, avgLen, usedArchetypes);
    usedArchetypes.add(archetype.id);
    const baseTagline = archetype.tagline(p, rank);
    const llmTagline = sanitizeLlmLine(llm?.tagline, usedTaglines);
    const tagline = llmTagline ?? baseTagline;
    if (!llmTagline) usedTaglines.add(tagline.toLowerCase());

    const baseHook = distinctiveStatHook(p, rank, usedStatHooks);
    const llmHook = sanitizeLlmLine(llm?.statHook, usedStatHooks);
    const statHook = llmHook ?? baseHook;

    return { alias: p.alias, tagline, statHook };
  });
}
