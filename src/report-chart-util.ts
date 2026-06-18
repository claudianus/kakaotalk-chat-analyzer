import type { CountItem, DailyCount, ReportTopic, TopicTrendGranularity } from "./types.js";

const CLOUD_BOILERPLATE_RE =
  /^(?:사이트|요약|short|oursophy|short oursophy|사이트 요약|요약입니다)(?:\s|$)/i;
const CLOUD_HTML_NOISE_RE =
  /(?:articleview|idxno|기사본문|타임스|timesnews|newsview|\.html|https?|www\.)/i;
const CLOUD_ASCII_ONLY_RE = /^[\x00-\x7F0-9\s._\-/]+$/;

export function isCloudNoiseLabel(label: string): boolean {
  const t = label.trim();
  if (t.length < 2) return true;
  if (CLOUD_BOILERPLATE_RE.test(t)) return true;
  if (CLOUD_HTML_NOISE_RE.test(t)) return true;
  if (/^요약/.test(t) && t.length <= 8) return true;
  if (CLOUD_ASCII_ONLY_RE.test(t) && !/[가-힣]/.test(t)) return true;
  return false;
}

/** 워드클라우드용 — 샵검색·HTML 스크랩·영문 URL 잔여 토큰 제거 */
export function keywordsForCloud(keywords: CountItem[], limit = 100): { label: string; count: number }[] {
  const filtered = keywords.filter((k) => !isCloudNoiseLabel(k.label));
  const pool = filtered.length > 0 ? filtered : keywords.filter((k) => k.label.trim().length >= 2);
  const scored = [...pool].sort((a, b) => {
    const laneBoost = (k: CountItem) =>
      k.keywordLane === "bm25" ? 3 : k.keywordLane === "both" ? 2 : k.keywordLane === "freq" ? 0 : 1;
    const hangulBoost = (k: CountItem) => (/[가-힣]{2,}/.test(k.label) ? 2 : 0);
    return laneBoost(b) - laneBoost(a) || hangulBoost(b) - hangulBoost(a) || b.count - a.count;
  });
  return scored.slice(0, limit).map((k) => ({ label: k.label, count: k.count }));
}

/** HTML·영문 노이즈가 많으면 막대 차트가 가독성이 낫다 */
export function cloudChartMode(keywords: CountItem[]): "bar" | "cloud" {
  const items = keywordsForCloud(keywords, 24);
  if (items.length < 6) return "bar";
  const hangulRich = items.filter((k) => /[가-힣]{2,}/.test(k.label)).length;
  if (hangulRich < 6) return "bar";
  const noisyTop = items.slice(0, 8).filter((k) => isCloudNoiseLabel(k.label)).length;
  if (noisyTop >= 3) return "bar";
  return "cloud";
}

/** 활동일 < 90일·활동 월 ≤ 2 — 월별 period 카드/차트는 기간 비교로 안내 */
export function isShortActivitySpan(daily: DailyCount[]): boolean {
  const active = daily.filter((d) => d.count > 0);
  if (active.length === 0 || active.length >= 90) return false;
  const months = new Set(active.map((d) => d.date.slice(0, 7)));
  return months.size <= 2;
}

export function topicsForDisplay(topics: ReportTopic[], daily: DailyCount[]): ReportTopic[] {
  const normalized = normalizeTopicPercents(topics);
  if (!isShortActivitySpan(daily)) return normalized;
  return normalized.filter((t) => t.kind === "theme");
}

export function topicsThemesOnly(topics: ReportTopic[]): ReportTopic[] {
  return normalizeTopicPercents(topics).filter((t) => t.kind === "theme");
}

export function chooseTopicTrendGranularity(args: {
  activeDays: number;
  spanDays: number;
}): TopicTrendGranularity {
  if (args.spanDays <= 31 || args.activeDays <= 14) return "daily";
  if (args.spanDays <= 180) return "weekly";
  return "monthly";
}

function normalizeTopicPercents(topics: ReportTopic[]): ReportTopic[] {
  return topics.map((t) => ({
    ...t,
    messagePercent: clampPercent(t.messagePercent),
  }));
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}
