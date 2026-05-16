import type {
  CalendarCell,
  CalendarMonthLabel,
  CalendarWeek,
  ConversationTone,
  DailyCount,
  ParticipantPersona,
  ParticipantStat,
  ReportInsights,
  ReportStory,
  StoryChapter,
  WrappedCard,
} from "./types.js";

const GH_MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const CHAPTER_GAP_DAYS = 7;

export interface BuildStoryInput {
  chatRoomName: string;
  totalMessages: number;
  activeDays: number;
  firstMessage: string | null;
  lastMessage: string | null;
  longestStreak: number;
  peakHour: number | null;
  busiestWeekdayLabel: string | null;
  nightSharePercent: number;
  emojiMessages: number;
  participants: ParticipantStat[];
  daily: DailyCount[];
  dailySenderCounts: Map<string, Map<string, number>>;
  senderAliases: Map<string, string>;
  insights: ReportInsights;
  laughMessages: number;
  shortMessages: number;
  laughBySender: Map<string, number>;
  shortBySender: Map<string, number>;
}

export function buildReportStory(input: BuildStoryInput): ReportStory {
  const tone = buildTone(input.totalMessages, input.laughMessages, input.shortMessages, input.emojiMessages);
  const wrapped = buildWrappedCards(input, tone);
  const personas = buildPersonas(input.participants, input.laughBySender, input.shortBySender);
  const chapters = buildChapters(
    input.daily,
    input.dailySenderCounts,
    input.senderAliases,
    input.totalMessages,
  );
  const { weeks, spanLabel, totalMessages, monthLabels } = buildCalendarGrid(input.daily);
  const headline = buildHeadline(input);

  return {
    headline,
    wrapped,
    personas,
    chapters,
    calendarWeeks: weeks,
    calendarSpanLabel: spanLabel,
    calendarTotalMessages: totalMessages,
    calendarMonthLabels: monthLabels,
    tone,
  };
}

export interface PersonaCounters {
  laughBySender: Map<string, number>;
  shortBySender: Map<string, number>;
}

export function buildTone(
  total: number,
  laugh: number,
  short: number,
  emoji: number,
): ConversationTone {
  const base = Math.max(total, 1);
  return {
    laughMessages: laugh,
    laughPer100: round((laugh / base) * 100, 1),
    shortMessages: short,
    shortPer100: round((short / base) * 100, 1),
    emojiPer100: round((emoji / base) * 100, 1),
  };
}

function buildHeadline(input: BuildStoryInput): string {
  const room = input.chatRoomName;
  const n = formatCompact(input.totalMessages);
  const parts: string[] = [`「${room}」에서 ${n}개의 메시지가 오갔어요.`];

  if (input.longestStreak >= 3) {
    parts.push(`최장 **${input.longestStreak}일** 연속 대화`);
  }
  if (input.peakHour !== null) {
    parts.push(`**${input.peakHour}시**가 가장 뜨거웠고`);
  }
  if (input.insights.rhythmScore >= 60) {
    parts.push(`리듬 점수 **${input.insights.rhythmScore}**점 — 꾸준한 방이에요.`);
  } else if (input.participants[0]) {
    parts.push(`**${input.participants[0].alias}**님이 대화를 이끌었어요.`);
  } else {
    parts.push("아래 카드에서 한 장면씩 펼쳐 보세요.");
  }

  return parts.slice(0, 3).join(" ");
}

function buildWrappedCards(input: BuildStoryInput, tone: ConversationTone): WrappedCard[] {
  const cards: WrappedCard[] = [];
  const top = input.participants[0];

  cards.push({
    id: "intro",
    emoji: "💬",
    title: input.chatRoomName,
    stat: formatCompact(input.totalMessages),
    sub: `메시지 · ${input.activeDays}일 활동 · ${input.participants.length}명`,
  });

  if (input.firstMessage && input.lastMessage) {
    cards.push({
      id: "span",
      emoji: "📅",
      title: "이야기의 길이",
      stat: spanDaysLabel(input.firstMessage, input.lastMessage),
      sub: `${trimDate(input.firstMessage)} → ${trimDate(input.lastMessage)}`,
    });
  }

  if (input.longestStreak >= 2) {
    cards.push({
      id: "streak",
      emoji: "🔥",
      title: "끊기지 않은 날들",
      stat: `${input.longestStreak}일`,
      sub: "하루도 빠짐없이 메시지가 이어진 최장 기록",
    });
  }

  if (input.peakHour !== null) {
    cards.push({
      id: "peak-hour",
      emoji: "⏰",
      title: "제2의 거실",
      stat: `${input.peakHour}시`,
      sub: "메시지가 가장 몰린 시간대",
    });
  }

  if (top) {
    cards.push({
      id: "mvp",
      emoji: "👑",
      title: "대화의 중심",
      stat: top.alias,
      sub: `전체의 ${top.sharePercent}% · 평균 ${top.averageLength}자`,
    });
  }

  cards.push({
    id: "rhythm",
    emoji: "🎵",
    title: "방 리듬 점수",
    stat: `${input.insights.rhythmScore}`,
    sub: "참여 균형 · 연속 활동 · 밀도를 합친 0~100점",
  });

  if (input.insights.weekendSharePercent >= 15) {
    cards.push({
      id: "weekend",
      emoji: "🌴",
      title: "주말의 비중",
      stat: `${input.insights.weekendSharePercent}%`,
      sub: "토·일 메시지 비율",
    });
  }

  if (tone.laughPer100 >= 5 || tone.emojiPer100 >= 3) {
    cards.push({
      id: "vibe",
      emoji: "😂",
      title: "분위기",
      stat: `${tone.laughPer100}`,
      sub: `웃음·리액션 느낌 100건당 · 이모지 ${tone.emojiPer100}건당`,
    });
  }

  if (input.insights.burstGapUnder1mPercent !== null && input.insights.burstGapUnder1mPercent >= 35) {
    cards.push({
      id: "speed",
      emoji: "⚡",
      title: "실시간 톤",
      stat: `${input.insights.burstGapUnder1mPercent}%`,
      sub: "응답 간격 1분 이내 비율",
    });
  }

  cards.push({
    id: "deep",
    emoji: "📊",
    title: "더 깊게",
    stat: "스크롤",
    sub: "숫자 요약 · 챕터 · 연간 그리드 · 차트가 이어집니다",
  });

  return cards.slice(0, 12);
}

function buildPersonas(
  participants: ParticipantStat[],
  laughBySender: Map<string, number>,
  shortBySender: Map<string, number>,
): ParticipantPersona[] {
  const out: ParticipantPersona[] = [];

  for (const p of participants.slice(0, 8)) {
    const laugh = laughBySender.get(p.alias) ?? 0;
    const short = shortBySender.get(p.alias) ?? 0;
    const msg = Math.max(p.messages, 1);
    const nightPct = round((p.nightMessages / msg) * 100, 1);
    const attachPct = round((p.attachmentMessages / msg) * 100, 1);
    const linkPct = round((p.linkMessages / msg) * 100, 1);
    const laughPct = round((laugh / msg) * 100, 1);
    const shortPct = round((short / msg) * 100, 1);

    type Cand = { score: number; title: string; reason: string };
    const cands: Cand[] = [];

    if (p.sharePercent >= 28) {
      cands.push({
        score: p.sharePercent,
        title: "대화의 중심",
        reason: `전체 메시지의 ${p.sharePercent}%`,
      });
    }
    if (nightPct >= 22) {
      cands.push({ score: nightPct, title: "새벽 요정", reason: `심야 메시지 ${nightPct}%` });
    }
    if (attachPct >= 16) {
      cands.push({ score: attachPct, title: "사진·첨부 장인", reason: `첨부 포함 ${attachPct}%` });
    }
    if (linkPct >= 10) {
      cands.push({ score: linkPct, title: "링크 큐레이터", reason: `링크 공유 ${linkPct}%` });
    }
    if (p.maxConsecutive >= 6) {
      cands.push({
        score: p.maxConsecutive * 4,
        title: "장문 연속왕",
        reason: `최대 ${p.maxConsecutive}연속 메시지`,
      });
    }
    if (p.averageLength >= 42) {
      cands.push({
        score: p.averageLength,
        title: "긴 글 작가",
        reason: `평균 ${p.averageLength}자`,
      });
    }
    if (laughPct >= 10) {
      cands.push({ score: laughPct, title: "분위기 메이커", reason: `리액션 톤 ${laughPct}%` });
    }
    if (shortPct >= 22) {
      cands.push({ score: shortPct, title: "짧답 요정", reason: `3자 이하 ${shortPct}%` });
    }

    const best = cands.sort((a, b) => b.score - a.score)[0];
    out.push({
      alias: p.alias,
      title: best?.title ?? "다재다능 상인",
      reason: best?.reason ?? "여러 패턴이 고르게 섞였어요",
    });
  }

  return out;
}

function buildChapters(
  daily: DailyCount[],
  dailySenderCounts: Map<string, Map<string, number>>,
  senderAliases: Map<string, string>,
  totalMessages: number,
): StoryChapter[] {
  if (daily.length === 0) return [];

  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
  const segments: DailyCount[][] = [];
  let cur: DailyCount[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1]!.date;
    const next = sorted[i]!.date;
    const gap = dayDiff(prev, next);
    if (gap > CHAPTER_GAP_DAYS) {
      segments.push(cur);
      cur = [];
    }
    cur.push(sorted[i]!);
  }
  segments.push(cur);

  return segments.map((days, index) => {
    const fromDate = days[0]!.date;
    const toDate = days[days.length - 1]!.date;
    const messages = days.reduce((a, d) => a + d.count, 0);
    const senderTotals = new Map<string, number>();

    for (const d of days) {
      const perDay = dailySenderCounts.get(d.date);
      if (!perDay) continue;
      for (const [raw, c] of perDay) {
        const alias = senderAliases.get(raw) ?? raw;
        senderTotals.set(alias, (senderTotals.get(alias) ?? 0) + c);
      }
    }

    let topAlias: string | null = null;
    let topCount = 0;
    for (const [alias, c] of senderTotals) {
      if (c > topCount) {
        topCount = c;
        topAlias = alias;
      }
    }
    const topSharePercent =
      messages > 0 && topAlias ? round((topCount / messages) * 100, 1) : null;
    const shareOfAll = totalMessages > 0 ? round((messages / totalMessages) * 100, 1) : 0;

    return {
      index: index + 1,
      label: segments.length === 1 ? "전체 기간" : `${index + 1}장`,
      fromDate,
      toDate,
      activeDays: days.length,
      messages,
      shareOfAll,
      topAlias,
      topSharePercent,
    };
  });
}

function buildCalendarGrid(daily: DailyCount[]): {
  weeks: CalendarWeek[];
  spanLabel: string;
  totalMessages: number;
  monthLabels: CalendarMonthLabel[];
} {
  if (daily.length === 0) {
    return { weeks: [], spanLabel: "", totalMessages: 0, monthLabels: [] };
  }

  const map = new Map(daily.map((d) => [d.date, d.count]));
  const sorted = [...map.keys()].sort();
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  let totalMessages = 0;

  const start = new Date(`${first}T12:00:00Z`);
  const end = new Date(`${last}T12:00:00Z`);
  const padStart = start.getUTCDay();
  const cursor = new Date(start);
  cursor.setUTCDate(cursor.getUTCDate() - padStart);

  const weeks: CalendarWeek[] = [];
  let week: CalendarCell[] = [];
  const levelThresholds = buildContributionLevelThresholds([...map.values()]);

  while (cursor.getTime() <= end.getTime() + 6 * 86_400_000) {
    const y = cursor.getUTCFullYear();
    const m = pad2(cursor.getUTCMonth() + 1);
    const d = pad2(cursor.getUTCDate());
    const key = `${y}-${m}-${d}`;
    const inRange = key >= first && key <= last;
    const count = inRange ? (map.get(key) ?? 0) : 0;
    if (inRange && count > 0) totalMessages += count;
    week.push({
      date: inRange ? key : null,
      count,
      level: inRange && count > 0 ? levelFromCount(count, levelThresholds) : 0,
    });

    if (week.length === 7) {
      weeks.push({ cells: week });
      week = [];
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (cursor.getTime() > end.getTime() + 7 * 86_400_000 && week.length === 0) break;
  }
  if (week.length > 0) {
    while (week.length < 7) week.push({ date: null, count: 0, level: 0 });
    weeks.push({ cells: week });
  }

  return {
    weeks,
    spanLabel: `${first} ~ ${last}`,
    totalMessages,
    monthLabels: buildMonthLabels(weeks),
  };
}

/** GitHub 잔디와 같이 활동 분포 사분위로 4단계 + 빈 칸 */
function buildContributionLevelThresholds(counts: number[]): number[] {
  const positive = counts.filter((c) => c > 0).sort((a, b) => a - b);
  if (positive.length === 0) return [];
  if (positive.length === 1) return [positive[0]!];
  const pick = (p: number) => positive[Math.min(positive.length - 1, Math.max(0, Math.ceil(p * positive.length) - 1))]!;
  const t1 = pick(0.25);
  const t2 = pick(0.5);
  const t3 = pick(0.75);
  const max = positive[positive.length - 1]!;
  return [...new Set([t1, t2, t3, max])].sort((a, b) => a - b);
}

function levelFromCount(count: number, thresholds: number[]): number {
  if (count <= 0) return 0;
  if (thresholds.length === 0) return 1;
  let level = 0;
  for (const t of thresholds) {
    if (count >= t) level += 1;
  }
  return Math.min(4, level);
}

function buildMonthLabels(weeks: CalendarWeek[]): CalendarMonthLabel[] {
  const labels: CalendarMonthLabel[] = [];
  let lastMonth = -1;
  for (let wi = 0; wi < weeks.length; wi++) {
    const firstInWeek = weeks[wi]!.cells.find((c) => c.date);
    if (!firstInWeek?.date) continue;
    const month = Number.parseInt(firstInWeek.date.slice(5, 7), 10) - 1;
    if (month !== lastMonth && month >= 0 && month < 12) {
      labels.push({ weekIndex: wi, label: GH_MONTH_SHORT[month]! });
      lastMonth = month;
    }
  }
  return labels;
}

function dayDiff(a: string, b: string): number {
  const ta = new Date(`${a}T12:00:00Z`).getTime();
  const tb = new Date(`${b}T12:00:00Z`).getTime();
  return Math.round((tb - ta) / 86_400_000);
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${round(n / 1_000_000, 1)}M`;
  if (n >= 10_000) return `${round(n / 1000, 1)}k`;
  if (n >= 1000) return `${round(n / 1000, 2)}k`;
  return n.toLocaleString("ko-KR");
}

function trimDate(dt: string): string {
  const m = dt.match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? dt;
}

function spanDaysLabel(first: string, last: string): string {
  const a = trimDate(first);
  const b = trimDate(last);
  const days = dayDiff(a, b) + 1;
  return `${days}일`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function round(n: number, d: number): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
