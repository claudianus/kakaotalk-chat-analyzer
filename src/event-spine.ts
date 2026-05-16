import type {
  DailyCount,
  DailyRoomPulse,
  ReportTimelineEvent,
  RepeatedPhraseStat,
} from "./types.js";

export interface BuildEventSpineInput {
  burstDays: DailyCount[];
  daily: DailyCount[];
  roomPulse: DailyRoomPulse[];
  repeatedPhrases: RepeatedPhraseStat[];
  maxSilenceBetweenActiveDays: number | null;
  dailyLinkSpikes: { date: string; links: number }[];
  dailyPlanSignals: { date: string; hits: number }[];
}

export function buildEventSpine(input: BuildEventSpineInput): ReportTimelineEvent[] {
  const events: ReportTimelineEvent[] = [];

  for (const b of input.burstDays.slice(0, 5)) {
    events.push({
      date: b.date,
      kind: "burst",
      title: "메시지 급증",
      detail: `${b.count}건 — 평소보다 활발한 날`,
      metric: b.count,
      jumpId: "s-viz",
    });
  }

  const silenceResume = findSilenceResume(input.daily, input.maxSilenceBetweenActiveDays);
  if (silenceResume) events.push(silenceResume);

  for (const p of input.roomPulse) {
    const churn = p.join + p.leave + p.kick;
    if (churn >= 5) {
      events.push({
        date: p.date,
        kind: "room",
        title: "입·퇴장 활발",
        detail: `입장 ${p.join} · 퇴장 ${p.leave} · 강퇴 ${p.kick}`,
        metric: churn,
      });
    }
    if (p.newSenders >= 3) {
      events.push({
        date: p.date,
        kind: "newcomer",
        title: "신규 참여자 유입",
        detail: `처음 말한 사람 ${p.newSenders}명`,
        metric: p.newSenders,
      });
    }
  }

  for (const s of input.dailyLinkSpikes.slice(0, 4)) {
    events.push({
      date: s.date,
      kind: "links",
      title: "링크 공유 집중",
      detail: `링크 포함 메시지 ${s.links}건`,
      metric: s.links,
    });
  }

  for (const r of input.repeatedPhrases.slice(0, 3)) {
    events.push({
      date: input.daily[0]?.date ?? "—",
      kind: "meme",
      title: "반복 문구",
      detail: `「${r.label}」 ${r.count}회`,
      metric: r.count,
    });
  }

  for (const pl of input.dailyPlanSignals.filter((d) => d.hits >= 3).slice(0, 4)) {
    events.push({
      date: pl.date,
      kind: "plan",
      title: "약속·일정 신호",
      detail: `날짜·시간 표현 ${pl.hits}건 (추정)`,
      metric: pl.hits,
    });
  }

  return events
    .sort((a, b) => a.date.localeCompare(b.date) || kindOrder(a.kind) - kindOrder(b.kind))
    .slice(0, 24);
}

function kindOrder(kind: string): number {
  const o: Record<string, number> = {
    burst: 0,
    silence: 1,
    room: 2,
    newcomer: 3,
    links: 4,
    plan: 5,
    meme: 6,
  };
  return o[kind] ?? 9;
}

function findSilenceResume(
  daily: DailyCount[],
  maxGap: number | null,
): ReportTimelineEvent | null {
  if (maxGap === null || maxGap < 5 || daily.length < 3) return null;
  const sorted = [...daily].filter((d) => d.count > 0).sort((a, b) => a.date.localeCompare(b.date));
  let bestGap = 0;
  let resumeDate: string | null = null;
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const gap = dayDiff(prev.date, cur.date) - 1;
    if (gap > bestGap) {
      bestGap = gap;
      resumeDate = cur.date;
    }
  }
  if (!resumeDate || bestGap < 5) return null;
  return {
    date: resumeDate,
    kind: "silence",
    title: "긴 침묵 후 재개",
    detail: `약 ${bestGap}일 쉰 뒤 대화가 다시 이어짐`,
    metric: bestGap,
  };
}

function dayDiff(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / 86_400_000);
}
