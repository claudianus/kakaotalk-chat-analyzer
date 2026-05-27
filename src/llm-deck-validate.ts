import type { ReportData } from "./types.js";
import type { LlmJsonShape } from "./llm-json.js";
import type { LlmInsights, LlmRoomArchetype } from "./types.js";

const KEYWORD_POOL_MAX = 80;
const GENERIC_ARCHETYPE_NAMES = new Set([
  "chatroom",
  "chatroom(이름 미전송)",
  "general",
  "no focus",
  "lack of keywords",
  "대화방",
  "일반 대화방",
  "잡담방",
]);
const LLM_FAILURE_TEXT_RE = /(?:messages are too general|specific archetype|more specific topic keywords|lack of keywords|no focus|cannot define|insufficient keywords|not enough context|이름 미전송)/i;

/** LLM 출력의 템플릿 잔여물·오류 메시지·JSON 키 필터링 */
export function isLlmGarbageText(value: string): boolean {
  const v = value.trim();
  if (v.length < 4) return true;
  // JSON 문법 잔여물
  if (/[\]}{]/.test(v)) return true;
  // 오류/메타 메시지
  if (/this is not correct|please wait|json|schema|format|template/i.test(v)) return true;
  if (LLM_FAILURE_TEXT_RE.test(v)) return true;
  // 통계 숫자만 나열 (쉼표·공백·%·숫자 외 문자 없음)
  if (/^[\d\s,%\.]+$/.test(v)) return true;
  // 키워드 없이 구두점·숫자만 있는 경우
  if (!/[\p{L}]/u.test(v)) return true;
  // JSON 필드명 그대로 출력된 경우 (camelCase 필드명)
  if (/^(?:topicProposals|topicTitles|insightBullets|shopSearchSummary|dyadInsight|roomArchetype|relationshipBeats|episodeCards|eraLabels|insideJokes|characterCards|dayMicroStories|shareLine|hashtags|counterfactuals|paragraphs|moments)$/i.test(v)) return true;
  // markdown fence나 json 키워드로 시작/끝
  if (/^```|^\{|\}$|^\[|\]$/.test(v)) return true;
  return false;
}

function keywordPool(data: ReportData): Set<string> {
  const pool = new Set<string>();
  const add = (value: string | undefined) => {
    const label = value?.trim();
    if (label && label.length >= 2) pool.add(label);
  };
  for (const k of data.keywords.slice(0, KEYWORD_POOL_MAX)) add(k.label);
  for (const t of data.topics.slice(0, 12)) {
    add(t.title);
    for (const term of t.terms.slice(0, 8)) add(term);
  }
  for (const t of data.dailyHotTopics.slice(0, 10)) {
    add(t.title);
    for (const term of t.keywords.slice(0, 6)) add(term);
  }
  for (const h of data.highlights) {
    for (const m of h.match(/[\p{L}\p{N}_#]+/gu) ?? []) {
      if (m.length >= 2) pool.add(m);
    }
  }
  return pool;
}

function statTokens(data: ReportData): Set<string> {
  const s = new Set<string>();
  const pushNum = (n: number | null | undefined) => {
    if (n === null || n === undefined || Number.isNaN(n)) return;
    s.add(String(n));
    s.add(String(Math.round(n)));
    if (!Number.isInteger(n)) s.add(n.toFixed(1));
  };
  pushNum(data.summary.totalMessages);
  pushNum(data.summary.participants);
  pushNum(data.summary.activeDays);
  pushNum(data.insights.rhythmScore);
  pushNum(data.insights.top3ParticipantSharePercent);
  pushNum(data.insights.weekendSharePercent);
  if (data.summary.peakHour !== null) s.add(`${data.summary.peakHour}`);
  return s;
}

function statRefOk(ref: string, data: ReportData): boolean {
  const t = ref.trim();
  if (t.length < 2) return false;
  const stats = statTokens(data);
  for (const tok of t.match(/\d+(?:\.\d+)?/g) ?? []) {
    const whole = tok.includes(".") ? tok.split(".")[0]! : tok;
    if (stats.has(tok) || stats.has(whole)) return true;
  }
  return data.highlights.some((h) => h.includes(t.slice(0, Math.min(24, t.length))));
}

function normalized(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function textHasEvidence(value: string, data: ReportData, kw = keywordPool(data)): boolean {
  const text = normalized(value);
  if (text.length < 4 || isLlmGarbageText(value)) return false;
  for (const token of kw) {
    const t = normalized(token);
    if (t.length >= 2 && text.includes(t)) return true;
  }
  for (const tok of text.match(/\d+(?:\.\d+)?/g) ?? []) {
    if (statTokens(data).has(tok) || statTokens(data).has(tok.split(".")[0]!)) return true;
  }
  return data.summary.totalMessages < 100 && kw.size === 0;
}

function sanitizeTrait(value: string, data: ReportData, kw: Set<string>): string | null {
  const trait = value.trim().slice(0, 32);
  if (!trait || /[\]}{]/.test(trait) || LLM_FAILURE_TEXT_RE.test(trait)) return null;
  if (GENERIC_ARCHETYPE_NAMES.has(normalized(trait))) return null;
  if (kw.size > 0 && !textHasEvidence(trait, data, kw)) return null;
  return trait;
}

function roomArchetypeIsUsable(arch: NonNullable<LlmJsonShape["roomArchetype"]>, data: ReportData, kw: Set<string>): boolean {
  const name = arch.name?.trim() ?? "";
  const description = arch.description?.trim() ?? "";
  if (!name || !description) return false;
  if (isLlmGarbageText(name) || isLlmGarbageText(description)) return false;
  if (GENERIC_ARCHETYPE_NAMES.has(normalized(name))) return false;
  if (kw.size === 0) return true;
  const traits = (arch.traits ?? []).join(" ");
  return textHasEvidence(`${name} ${description} ${traits}`, data, kw);
}

function topEvidenceTerms(data: ReportData, limit = 4): string[] {
  const terms: string[] = [];
  for (const t of data.topics) terms.push(...t.terms.slice(0, 3));
  terms.push(...data.keywords.slice(0, limit * 2).map((k) => k.label));
  for (const t of data.dailyHotTopics) terms.push(...t.keywords.slice(0, 2));
  const seen = new Set<string>();
  return terms
    .map((t) => t.trim())
    .filter((t) => {
      const key = normalized(t);
      if (t.length < 2 || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function fallbackRoomArchetype(data: ReportData): LlmRoomArchetype | undefined {
  const terms = topEvidenceTerms(data, 4);
  if (terms.length < 2) return undefined;
  const firstTopic = data.topics.find((t) => t.kind === "theme") ?? data.topics[0];
  const name = terms.some((t) => /클로드|코덱스|cursor|커서|code|코드|개발|프롬프트/i.test(t))
    ? "AI 코딩 실험실"
    : `${terms[0]}·${terms[1]} 라운지`;
  const topicPart = firstTopic ? `${firstTopic.title} 흐름` : `${terms.slice(0, 2).join("·")} 언급`;
  return {
    name,
    description: `${terms.slice(0, 4).join(" · ")} 키워드와 ${topicPart}이 반복되는 방입니다.`,
    traits: terms.slice(0, 3),
  };
}

export function sanitizeLlmParagraphs(paragraphs: string[] | undefined, data: ReportData): string[] {
  const kw = keywordPool(data);
  return (paragraphs ?? [])
    .map((p) => p.trim().slice(0, 180))
    .filter((p) => p.length > 8 && textHasEvidence(p, data, kw))
    .slice(0, 3);
}

export function sanitizeLlmDeck(parsed: LlmJsonShape, data: ReportData): Partial<LlmInsights> {
  const kw = keywordPool(data);
  const out: Partial<LlmInsights> = {};

  const arch = parsed.roomArchetype;
  if (arch && roomArchetypeIsUsable(arch, data, kw)) {
    const traits = (arch.traits ?? [])
      .map((t) => sanitizeTrait(t, data, kw))
      .filter((t): t is string => Boolean(t))
      .slice(0, 4);
    out.roomArchetype = {
      name: arch.name!.trim().slice(0, 40),
      description: arch.description!.trim().slice(0, 200),
      traits,
    };
  } else {
    const fallback = fallbackRoomArchetype(data);
    if (fallback) out.roomArchetype = fallback;
  }

  const moments = (parsed.moments ?? [])
    .filter((m) => m.headline?.trim() && m.statRef?.trim() && statRefOk(m.statRef, data))
    .slice(0, 5)
    .map((m) => ({
      headline: m.headline!.trim().slice(0, 120),
      statRef: m.statRef!.trim().slice(0, 80),
    }));
  if (moments.length) out.moments = moments;

  const beats = (parsed.relationshipBeats ?? [])
    .filter((b) => b.pair?.trim() && b.beat?.trim())
    .slice(0, 4)
    .map((b) => ({
      pair: b.pair!.trim().slice(0, 48),
      beat: b.beat!.trim().slice(0, 120),
      role: b.role?.trim().slice(0, 24),
    }));
  if (beats.length) out.relationshipBeats = beats;

  const episodes = (parsed.episodeCards ?? [])
    .filter((e) => e.title?.trim())
    .slice(0, 6)
    .map((e) => ({
      period: (e.period ?? "").trim().slice(0, 40),
      title: e.title!.trim().slice(0, 48),
      tagline: (e.tagline ?? "").trim().slice(0, 80),
      emoji: (e.emoji ?? "📖").trim().slice(0, 4) || "📖",
    }));
  if (episodes.length) out.episodeCards = episodes;

  const eras = (parsed.eraLabels ?? [])
    .filter((e) => e.label?.trim())
    .slice(0, 3)
    .map((e) => ({
      label: e.label!.trim().slice(0, 48),
      detail: (e.detail ?? "").trim().slice(0, 120),
    }));
  if (eras.length) out.eraLabels = eras;

  const jokes = (parsed.insideJokes ?? [])
    .filter((j) => j.label?.trim())
    .slice(0, 5)
    .map((j) => {
      const evidence = (j.evidenceKeywords ?? [])
        .map((k) => k.trim())
        .filter((k) => k && kw.has(k))
        .slice(0, 4);
      return {
        label: j.label!.trim().slice(0, 40),
        whyFunny: (j.whyFunny ?? "").trim().slice(0, 120),
        evidenceKeywords: evidence,
      };
    })
    .filter((j) => j.evidenceKeywords.length > 0 || j.whyFunny.length > 8);
  if (jokes.length) out.insideJokes = jokes;

  const chars = (parsed.characterCards ?? [])
    .filter((c) => c.alias?.trim())
    .slice(0, 3)
    .map((c) => ({
      alias: c.alias!.trim().slice(0, 32),
      tagline: (c.tagline ?? "").trim().slice(0, 80),
      statHook: (c.statHook ?? "").trim().slice(0, 60),
    }));
  if (chars.length) out.characterCards = chars;

  const days = (parsed.dayMicroStories ?? [])
    .filter((d) => d.date?.trim() && d.line?.trim())
    .slice(0, 5)
    .map((d) => ({
      date: d.date!.trim().slice(0, 10),
      line: d.line!.trim().slice(0, 120),
    }));
  if (days.length) out.dayMicroStories = days;

  if (parsed.shareLine?.trim()) {
    out.shareLine = parsed.shareLine.trim().slice(0, 160);
  }
  const tags = (parsed.hashtags ?? []).map((h) => h.trim().replace(/^#/, "")).filter(Boolean).slice(0, 3);
  if (tags.length) out.hashtags = tags.map((h) => h.slice(0, 24));

  const cf = (parsed.counterfactuals ?? [])
    .filter((c) => c.text?.trim())
    .slice(0, 2)
    .map((c) => ({ text: c.text!.trim().slice(0, 120) }));
  if (cf.length) out.counterfactuals = cf;

  return out;
}
