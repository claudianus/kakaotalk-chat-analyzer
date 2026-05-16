import type { ActivityArcSegment, CountItem, DailyCount, PeriodCompareSlice } from "./types.js";

export interface BuildPeriodCompareInput {
  activityArc: ActivityArcSegment[];
  daily: DailyCount[];
  monthly: DailyCount[];
  headKeywords: CountItem[];
  tailKeywords: CountItem[];
}

export function buildPeriodCompare(input: BuildPeriodCompareInput): {
  slices: PeriodCompareSlice[];
  keywordShift: { head: string[]; tail: string[]; onlyHead: string[]; onlyTail: string[] };
} {
  const slices: PeriodCompareSlice[] = input.activityArc.map((a) => ({
    id: a.id,
    label: a.label,
    messages: a.messages,
    activeDays: a.activeDays,
    messagesPerActiveDay:
      a.activeDays > 0 ? Math.round((a.messages / a.activeDays) * 10) / 10 : 0,
  }));

  const headSet = new Set(input.headKeywords.map((k) => k.label));
  const tailSet = new Set(input.tailKeywords.map((k) => k.label));
  const onlyHead = input.headKeywords.map((k) => k.label).filter((l) => !tailSet.has(l)).slice(0, 8);
  const onlyTail = input.tailKeywords.map((k) => k.label).filter((l) => !headSet.has(l)).slice(0, 8);

  return {
    slices,
    keywordShift: {
      head: input.headKeywords.slice(0, 6).map((k) => k.label),
      tail: input.tailKeywords.slice(0, 6).map((k) => k.label),
      onlyHead,
      onlyTail,
    },
  };
}

/** daily 기준 전반/후반 날짜 경계로 키워드 버킷 분리용 날짜 컷 */
export function periodCutDate(daily: DailyCount[]): string | null {
  const active = daily.filter((d) => d.count > 0).sort((a, b) => a.date.localeCompare(b.date));
  if (active.length < 14) return null;
  const mid = active[Math.floor(active.length / 2)]!;
  return mid.date;
}
