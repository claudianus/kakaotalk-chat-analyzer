import type { DailyCount, ReportTopic } from "./types.js";

/** 활동일 < 90일·활동 월 ≤ 2 — 월별 period 카드/차트는 기간 비교로 안내 */
export function isShortActivitySpan(daily: DailyCount[]): boolean {
  const active = daily.filter((d) => d.count > 0);
  if (active.length === 0 || active.length >= 90) return false;
  const months = new Set(active.map((d) => d.date.slice(0, 7)));
  return months.size <= 2;
}

export function topicsForDisplay(topics: ReportTopic[], daily: DailyCount[]): ReportTopic[] {
  if (!isShortActivitySpan(daily)) return topics;
  return topics.filter((t) => t.kind === "theme");
}

export function topicsThemesOnly(topics: ReportTopic[]): ReportTopic[] {
  return topics.filter((t) => t.kind === "theme");
}
