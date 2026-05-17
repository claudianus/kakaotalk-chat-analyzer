import { canonicalKeywordToken } from "./keyword-canonical.js";
import type { ReportTopic } from "./types.js";

/** 채팅 축약·표기 변형 → 대표 토큰 */
const TOPIC_TERM_ALIASES: Record<string, string> = {
  클코: "클로드",
  클코드: "클로드",
  클로드코드: "클로드",
  클로드가: "클로드",
  클로드는: "클로드",
  클코가: "클로드",
  클코는: "클로드",
  코덱스는: "코덱스",
  코덱스가: "코덱스",
  토큰이: "토큰",
  토큰은: "토큰",
};

const TRAILING_PARTICLE_RE =
  /(?:이|가|은|는|을|를|에|의|로|와|과|도|만|요|죠|네|지|서|야|다|함|임|음|들)$/u;

export function normalizeTopicTerm(raw: string): string {
  let t = canonicalKeywordToken(raw.trim());
  if (!t) return "";
  if (TOPIC_TERM_ALIASES[t]) return TOPIC_TERM_ALIASES[t]!;
  if (t.length > 2 && TRAILING_PARTICLE_RE.test(t)) {
    const stem = t.replace(TRAILING_PARTICLE_RE, "");
    if (stem.length >= 2) {
      t = TOPIC_TERM_ALIASES[stem] ?? stem;
    }
  }
  return TOPIC_TERM_ALIASES[t] ?? t;
}

export function normalizeTopicTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of terms) {
    const t = normalizeTopicTerm(raw);
    if (t.length < 2 || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** 제목 · 구분 — 순서 무관 동일 키 */
export function topicPairKey(title: string): string {
  const parts = title
    .split(/\s*·\s*/)
    .map((p) => normalizeTopicTerm(p))
    .filter((p) => p.length >= 2);
  if (parts.length === 0) return normalizeTopicTerm(title);
  return [...new Set(parts)].sort().join("|");
}

function jaccardSets(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = new Set([...a, ...b]).size;
  return union > 0 ? inter / union : 0;
}

function themeLead(topic: ReportTopic): string {
  const fromTitle = topic.title.split(/\s*·\s*/)[0]?.trim() ?? "";
  return normalizeTopicTerm(fromTitle || (topic.terms[0] ?? topic.title));
}

function sharedAnchorSimilarity(a: Set<string>, b: Set<string>): boolean {
  if (a.size < 2 || b.size < 2) return false;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  if (inter < 2) return false;
  const smaller = a.size <= b.size ? a : b;
  const larger = a.size <= b.size ? b : a;
  let sub = true;
  for (const x of smaller) if (!larger.has(x)) sub = false;
  return sub;
}

/** 테마 유사도 0–1 (병합·시드 스킵용) */
export function topicSimilarity(a: ReportTopic, b: ReportTopic): number {
  if (a.kind !== "theme" || b.kind !== "theme") return 0;

  const pairA = topicPairKey(a.title);
  const pairB = topicPairKey(b.title);
  if (pairA.length > 0 && pairA === pairB) return 1;

  const setA = new Set(normalizeTopicTerms(a.terms));
  const setB = new Set(normalizeTopicTerms(b.terms));
  const jac = jaccardSets(setA, setB);
  if (jac >= 0.42) return jac;

  if (themeLead(a) === themeLead(b) && jac >= 0.3) return Math.max(jac, 0.45);
  if (sharedAnchorSimilarity(setA, setB)) return Math.max(jac, 0.5);

  return jac;
}

export function normalizedTermsKey(terms: string[]): string {
  return normalizeTopicTerms(terms)
    .sort()
    .slice(0, 5)
    .join("\t");
}
