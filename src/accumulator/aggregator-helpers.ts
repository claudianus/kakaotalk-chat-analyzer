/**
 * ReportAggregator 헬퍼 함수 — aggregator.ts에서 추출한 순수 함수들.
 * 클래스 상태에 의존하지 않으며 독립적으로 동작합니다.
 */
import type { CountItem, ParsedDateParts, ParticipantRole, ParticipantStat, PrivacyMode } from "../types.js";
import { KeywordCounter } from "../keyword-counter.js";
import { maskPartialDisplayName } from "../analysis-labels.js";
import { partsToUtcMs } from "../date.js";
import { formatCompactNumber, formatReplyGapMinutes } from "../report-util.js";

/* ── 기본 유틸 ── */

export function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

export function medianSorted(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function increment(map: Map<string, number>, key: string, amount = 1): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

export function topCounts(map: Map<string, number>, limit: number): CountItem[] {
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

/* ── 참여자·레이블 ── */

export function buildSenderLabels(senders: string[], privacy: PrivacyMode): Map<string, string> {
  const unique = [...new Set(senders)];
  if (privacy === "public-anonymous") {
    const map = new Map<string, string>();
    unique.forEach((sender, i) => map.set(sender, `User ${String(i + 1).padStart(3, "0")}`));
    return map;
  }
  const map = new Map<string, string>();
  const used = new Map<string, number>();
  for (const raw of unique) {
    let base = maskPartialDisplayName(raw);
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    if (n > 1) base = `${base}·${n}`;
    map.set(raw, base);
  }
  return map;
}

export function normalizeToken(token: string): string {
  return /^[A-Za-z0-9_+-]+$/.test(token) ? token.toLowerCase() : token.trim();
}

/* ── URL·도메인 ── */

const URL_RE = /\bhttps?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi;

export function getDomains(message: string): string[] {
  const matches = message.match(URL_RE) ?? [];
  const domains: string[] = [];
  for (const match of matches) {
    const urlText = match.startsWith("http") ? match : `https://${match}`;
    try {
      const url = new URL(urlText);
      domains.push(url.hostname.toLowerCase().replace(/^www\./, ""));
    } catch {
      continue;
    }
  }
  return domains;
}

/* ── 통계·지표 ── */

export function longestDateStreak(sortedYmd: string[]): number {
  if (sortedYmd.length === 0) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sortedYmd.length; i += 1) {
    const a = new Date(`${sortedYmd[i - 1]}T12:00:00Z`).getTime();
    const b = new Date(`${sortedYmd[i]}T12:00:00Z`).getTime();
    const diffDays = Math.round((b - a) / 86_400_000);
    if (diffDays === 1) { cur += 1; best = Math.max(best, cur); }
    else { cur = 1; }
  }
  return best;
}

export function computeGini(counts: number[]): number | null {
  if (counts.length === 0) return null;
  const sorted = [...counts].sort((a, b) => a - b);
  const n = sorted.length;
  let sum = 0;
  for (const x of sorted) sum += x;
  if (sum === 0) return null;
  let num = 0;
  for (let i = 0; i < n; i += 1) {
    num += (2 * i - n + 1) * sorted[i]!;
  }
  return round(num / (n * sum), 3);
}

export function maxSilenceGapDays(sortedYmd: string[]): number | null {
  if (sortedYmd.length < 2) return null;
  let best = 0;
  for (let i = 1; i < sortedYmd.length; i += 1) {
    const a = new Date(`${sortedYmd[i - 1]}T12:00:00Z`).getTime();
    const b = new Date(`${sortedYmd[i]}T12:00:00Z`).getTime();
    const diffDays = Math.round((b - a) / 86_400_000);
    best = Math.max(best, Math.max(0, diffDays - 1));
  }
  return best;
}

export function computeDensityFromSpan(
  first: ParsedDateParts | null, last: ParsedDateParts | null, total: number,
): number | null {
  if (total === 0 || !first || !last) return null;
  const spanDays = Math.max(1, Math.floor((partsToUtcMs(last) - partsToUtcMs(first)) / 86_400_000) + 1);
  return round(total / spanDays, 2);
}

export function domainEntropyBits(domains: Map<string, number>): number | null {
  let sum = 0;
  for (const c of domains.values()) sum += c;
  if (sum === 0) return null;
  let h = 0;
  for (const c of domains.values()) {
    if (c <= 0) continue;
    const p = c / sum;
    h -= p * Math.log2(p);
  }
  return round(h, 2);
}

export function computeRhythmScore(input: {
  gini: number | null; longestStreak: number; density: number | null;
}): number {
  const g = input.gini ?? 0.45;
  const streakN = Math.min(1, input.longestStreak / 28);
  const densityN = input.density != null ? Math.min(1, input.density / 40) : 0.25;
  const score = 48 * (1 - Math.min(0.95, g)) + 32 * streakN + 20 * densityN;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/* ── 참여자 통계 ── */

interface MutableParticipantStat {
  messages: number; characters: number; attachmentMessages: number;
  linkMessages: number; nightMessages: number; maxConsecutive: number;
}

export function getParticipantStat(
  stats: Map<string, MutableParticipantStat>, sender: string,
): MutableParticipantStat {
  const existing = stats.get(sender);
  if (existing) return existing;
  const created: MutableParticipantStat = {
    messages: 0, characters: 0, attachmentMessages: 0,
    linkMessages: 0, nightMessages: 0, maxConsecutive: 0,
  };
  stats.set(sender, created);
  return created;
}

export function computeTop3Share(stats: Map<string, MutableParticipantStat>, total: number): number {
  if (total === 0) return 0;
  const top3 = [...stats.values()]
    .map((s) => s.messages).sort((a, b) => b - a).slice(0, 3)
    .reduce((a, c) => a + c, 0);
  return round((top3 / total) * 100, 1);
}

/* ── 시간대 ── */

export function computeDaypartPercents(
  hourly: number[], total: number,
): { key: string; label: string; percent: number }[] {
  const bands = [
    { key: "dawn", label: "새벽(0~5시)", lo: 0, hi: 5 },
    { key: "morning", label: "오전(6~11시)", lo: 6, hi: 11 },
    { key: "afternoon", label: "오후(12~17시)", lo: 12, hi: 17 },
    { key: "evening", label: "저녁(18~23시)", lo: 18, hi: 23 },
  ] as const;
  if (total === 0) return bands.map((b) => ({ key: b.key, label: b.label, percent: 0 }));
  const raw = bands.map((b) => {
    let c = 0;
    for (let h = b.lo; h <= b.hi; h += 1) c += hourly[h] ?? 0;
    return { key: b.key, label: b.label, count: c };
  });
  const sum = raw.reduce((a, x) => a + x.count, 0) || 1;
  let rounded = raw.map((x) => ({
    key: x.key, label: x.label,
    percent: round((x.count / sum) * 100, 1),
  }));
  const drift = 100 - rounded.reduce((a, x) => a + x.percent, 0);
  if (Math.abs(drift) >= 0.05 && rounded.length > 0) {
    const idx = rounded.reduce((best, x, i, arr) => (x.percent >= arr[best]!.percent ? i : best), 0);
    rounded = rounded.map((x, i) => (i === idx ? { ...x, percent: round(x.percent + drift, 1) } : x));
  }
  return rounded;
}

/* ── 키워드 ── */

export function top1ShareFromCounts(keywords: { count: number }[], totalMessages: number): number | null {
  if (keywords.length === 0 || totalMessages === 0) return null;
  const sum = keywords.reduce((a, k) => a + k.count, 0);
  if (sum === 0) return null;
  return round((keywords[0]!.count / sum) * 100, 1);
}

export function typeRichnessFromKeywords(
  keywords: { label: string; count: number }[], totalMessages: number,
): number | null {
  if (totalMessages === 0 || keywords.length === 0) return null;
  const tokenSum = keywords.reduce((a, k) => a + k.count, 0);
  if (tokenSum === 0) return null;
  return round((keywords.length / tokenSum) * 100, 1);
}

export function splitMonthlyKeywordBuckets(
  buckets: Map<string, KeywordCounter>,
): { headKeywords: CountItem[]; tailKeywords: CountItem[] } {
  const months = [...buckets.keys()].sort();
  if (months.length < 2) return { headKeywords: [], tailKeywords: [] };
  const mid = Math.floor(months.length / 2);
  const mergeMonths = (keys: string[]) => {
    const acc = new KeywordCounter();
    for (const k of keys) {
      const b = buckets.get(k);
      if (!b) continue;
      for (const item of b.topCounts(40)) acc.addHits(item.label, item.count);
    }
    return acc.topCounts(12);
  };
  return {
    headKeywords: mergeMonths(months.slice(0, mid)),
    tailKeywords: mergeMonths(months.slice(mid)),
  };
}

export function topDailyLinkSpikes(
  dailyLinks: Map<string, number>,
): { date: string; links: number }[] {
  return [...dailyLinks.entries()]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([date, links]) => ({ date, links }));
}

/* ── 방 이벤트 ── */

export type RoomEventCounts = {
  join: number; leave: number; deleted: number; hidden: number; kick: number;
  slowModeOn: number; slowModeOff: number; subManager: number; manager: number;
  shopSearch: number; photoBundle: number;
};

export function buildRoomEventStats(
  total: number, c: RoomEventCounts,
  shopExtra?: { tagExtractions: number; uniqueTags: number; untaggedNotices: number },
): import("../types.js").RoomEventStats {
  const sum = c.join + c.leave + c.deleted + c.hidden + c.kick +
    c.slowModeOn + c.slowModeOff + c.subManager + c.manager +
    c.shopSearch + c.photoBundle;
  const pct = (n: number) => (total > 0 ? round((n / total) * 100, 2) : 0);
  return {
    joinCount: c.join, leaveCount: c.leave, deletedCount: c.deleted,
    hiddenCount: c.hidden, kickCount: c.kick,
    slowModeOnCount: c.slowModeOn, slowModeOffCount: c.slowModeOff,
    subManagerCount: c.subManager, managerCount: c.manager,
    shopSearchCount: c.shopSearch,
    shopSearchTagExtractions: shopExtra?.tagExtractions ?? 0,
    shopSearchUniqueTags: shopExtra?.uniqueTags ?? 0,
    shopSearchUntaggedNotices: shopExtra?.untaggedNotices ?? 0,
    photoBundleCount: c.photoBundle, total: sum,
    joinSharePercent: pct(c.join), leaveSharePercent: pct(c.leave),
    deletedSharePercent: pct(c.deleted), hiddenSharePercent: pct(c.hidden),
    kickSharePercent: pct(c.kick),
  };
}

/* ── 참여자 역할 ── */

export function buildParticipantRoles(
  participants: ParticipantStat[], laughBySender: Map<string, number>,
  shortBySender: Map<string, number>, aliases: Map<string, string>,
): ParticipantRole[] {
  if (participants.length === 0) return [];
  const sortedByMessages = [...participants].sort((a, b) => b.messages - a.messages);
  const avgLengthOverall = participants.reduce((sum, p) => sum + p.averageLength, 0) / participants.length;
  const pickedRoles = new Set<string>();
  const results: ParticipantRole[] = [];

  for (const p of participants) {
    const rawAlias = [...aliases.entries()].find(([, a]) => a === p.alias)?.[0];
    const laughCount = rawAlias ? (laughBySender.get(rawAlias) ?? 0) : 0;
    const shortCount = rawAlias ? (shortBySender.get(rawAlias) ?? 0) : 0;
    const msg = Math.max(p.messages, 1);
    const laughRate = laughCount / msg;
    const shortRate = shortCount / msg;
    const nightRate = p.nightMessages / msg;
    const attachRate = p.attachmentMessages / msg;
    const linkRate = p.linkMessages / msg;
    const rank = sortedByMessages.findIndex((x) => x.alias === p.alias);
    const candidates: { role: string; confidence: number; reason: string; score: number }[] = [];

    if (rank === 0 && p.sharePercent >= 18) {
      candidates.push({ role: "주도형", confidence: 0.92, reason: `메시지 비중 ${p.sharePercent}%로 대화 흐름을 가장 많이 만든 참여자`, score: p.sharePercent + 30 });
    }
    if (p.averageLength >= Math.max(28, avgLengthOverall * 1.45)) {
      candidates.push({ role: "긴글러", confidence: 0.88, reason: `평균 ${p.averageLength}자로 긴 설명을 남기는 편`, score: p.averageLength });
    }
    if (laughRate >= 0.12 && laughCount >= 8) {
      candidates.push({ role: "분위기 메이커", confidence: 0.86, reason: `웃음 반응이 ${Math.round(laughRate * 100)}%로 뚜렷함`, score: laughRate * 100 });
    }
    if (shortRate >= 0.22 && shortCount >= 12) {
      candidates.push({ role: "리액션러", confidence: 0.84, reason: `짧은 응답 비중 ${Math.round(shortRate * 100)}%로 빠른 반응이 많음`, score: shortRate * 100 });
    }
    if (linkRate >= 0.08 && p.linkMessages >= 8) {
      candidates.push({ role: "자료 공유자", confidence: 0.84, reason: `링크 포함 메시지 ${p.linkMessages}건으로 자료 공유 신호가 강함`, score: linkRate * 100 });
    }
    if (attachRate >= 0.1 && p.attachmentMessages >= 8) {
      candidates.push({ role: "첨부 장인", confidence: 0.82, reason: `사진·파일 첨부 ${p.attachmentMessages}건으로 시각 자료 기여가 큼`, score: attachRate * 100 });
    }
    if (nightRate >= 0.25 && p.nightMessages >= 10) {
      candidates.push({ role: "심야 상주자", confidence: 0.82, reason: `심야 메시지 ${p.nightMessages}건으로 늦은 시간 활동이 두드러짐`, score: nightRate * 100 });
    }
    if (p.maxConsecutive >= 10) {
      candidates.push({ role: "연속 발화자", confidence: 0.82, reason: `최대 ${p.maxConsecutive}연속 발화로 한 번에 흐름을 길게 이어감`, score: p.maxConsecutive * 3 });
    }

    candidates.sort((a, b) => b.score - a.score);
    const picked = candidates.find((c) => !pickedRoles.has(c.role));
    if (!picked) continue;
    pickedRoles.add(picked.role);
    results.push({ alias: p.alias, role: picked.role, confidence: picked.confidence, reason: picked.reason });
    if (results.length >= 6) break;
  }

  return results;
}

export function formatDayMdHighlight(ymd: string): string {
  const p = ymd.split("-");
  if (p.length === 3) return `${Number(p[1])}/${Number(p[2])}`;
  return ymd;
}

export function buildHighlights(input: {
  total: number; topAlias: string | null; topShare: number | null;
  busiestWeekdayLabel: string | null; peakHour: number | null;
  medianReplyGapMinutes: number | null; nightSharePercent: number; longestStreak: number;
  emojiMessages: number; messagesWithAttachments: number; weekendSharePercent: number;
  participantGini: number | null; replyGapP90Minutes: number | null;
  maxSilenceBetweenActiveDays: number | null; rhythmScore: number;
  burstGapUnder1mPercent: number | null; monologueMessagesPercent: number;
  roomJoinMessages: number; roomLeaveMessages: number; roomDeletedMessages: number;
  roomHiddenMessages: number; roomKickMessages: number; pureLaughMessages: number;
  repeatedPhraseCount: number;
  burstDays: { date: string; count: number }[];
  activityArc: { id: string; label: string; messages: number; activeDays: number }[];
  conversationPace: { label: string; emoji: string; detail: string };
  roomPulse: { date: string; join: number; leave: number; hidden: number; kick: number; newSenders: number }[];
  lexicalTypeRichnessPercent: number | null; speakerSwitchRatePer100: number;
}): string[] {
  const out: string[] = [];
  if (input.topAlias && input.topShare !== null && input.total > 0)
    out.push(`가장 말이 많았던 분은 **${input.topAlias}** (전체의 **${input.topShare}%**).`);
  if (input.busiestWeekdayLabel)
    out.push(`요일별로는 **${input.busiestWeekdayLabel}**에 활동이 가장 활발했어요.`);
  if (input.peakHour !== null)
    out.push(`시간대는 **${input.peakHour}시**대에 메시지가 가장 몰렸습니다.`);
  if (input.medianReplyGapMinutes !== null)
    out.push(`연속 메시지 사이 간격의 중앙값은 **${formatReplyGapMinutes(input.medianReplyGapMinutes)}** 정도예요.`);
  if (input.nightSharePercent > 0)
    out.push(`심야(23~05시) 메시지 비중은 **${input.nightSharePercent}%**입니다.`);
  if (input.longestStreak > 1)
    out.push(`하루도 빠짐없이 이어진 최장 **${input.longestStreak}일** 연속 활동 기록이 있어요.`);
  if (input.emojiMessages > 0)
    out.push(`이모지·스티커 느낌의 메시지는 **${input.emojiMessages}**건 정도 감지됐어요.`);
  if (input.messagesWithAttachments > 0)
    out.push(`사진·파일·동영상 등 첨부가 들어간 메시지는 **${input.messagesWithAttachments}**건입니다.`);
  if (input.total > 0 && input.weekendSharePercent > 0)
    out.push(`주말(토·일) 메시지 비중은 **${input.weekendSharePercent}%**예요.`);
  if (input.participantGini !== null && input.participantGini >= 0.35)
    out.push(`참여도는 소수에게 조금 몰린 편이에요(지니 **${input.participantGini}** — 1에 가까울수록 쏠림).`);
  if (input.replyGapP90Minutes !== null && input.replyGapP90Minutes >= 30)
    out.push(`가끔 긴 침묵도 있어요 — 응답 간격 **상위 10%**가 약 **${input.replyGapP90Minutes}분** 이상입니다.`);
  if (input.maxSilenceBetweenActiveDays !== null && input.maxSilenceBetweenActiveDays >= 7)
    out.push(`활동일 사이 최대 **${input.maxSilenceBetweenActiveDays}일** 동안은 메시지가 끊긴 구간이 있었어요.`);
  if (input.rhythmScore >= 65)
    out.push(`종합 **리듬 점수**는 **${input.rhythmScore}/100** — 꾸준하고 균형 잡힌 페이스에 가깝습니다.`);
  if (input.burstGapUnder1mPercent !== null && input.burstGapUnder1mPercent >= 40)
    out.push(`응답 간격의 **${input.burstGapUnder1mPercent}%**가 1분 이내로, 실시간 대화 톤이 강해요.`);
  if (input.monologueMessagesPercent >= 25)
    out.push(`같은 사람 **3연속 이상** 메시지가 전체의 **${input.monologueMessagesPercent}%** — 긴 설명·정리 구간이 잦을 수 있어요.`);
  const sysTotal = input.roomJoinMessages + input.roomLeaveMessages + input.roomDeletedMessages +
    input.roomHiddenMessages + input.roomKickMessages;
  if (sysTotal > 0) {
    const parts = [
      input.roomJoinMessages > 0 ? `들어옴 ${input.roomJoinMessages}` : "",
      input.roomLeaveMessages > 0 ? `나감 ${input.roomLeaveMessages}` : "",
      input.roomDeletedMessages > 0 ? `삭제 ${input.roomDeletedMessages}` : "",
      input.roomHiddenMessages > 0 ? `가림 ${input.roomHiddenMessages}` : "",
      input.roomKickMessages > 0 ? `강퇴 ${input.roomKickMessages}` : "",
    ].filter(Boolean);
    out.push(`카카오톡 **시스템·운영 알림** **${sysTotal}**건(${parts.join(" · ")}) — 본문 키워드와 분리했어요.`);
  }
  if (input.pureLaughMessages > 0)
    out.push(`**ㅋㅋ만** 보낸 리액션 메시지는 **${input.pureLaughMessages}**건이에요.`);
  if (input.repeatedPhraseCount >= 10)
    out.push(`똑같은 문장이 **${input.repeatedPhraseCount}회** 반복된 복붙·환영 문구도 있어요.`);
  if (input.burstDays.length > 0) {
    const top = input.burstDays[0]!;
    const labels = input.burstDays.slice(0, 3).map((d) => formatDayMdHighlight(d.date)).join(" · ");
    out.push(`메시지가 평소보다 몰린 날 **${input.burstDays.length}일** — 최고는 **${formatDayMdHighlight(top.date)}**(${formatCompactNumber(top.count)}건). ${labels}`);
  }
  const head = input.activityArc.find((a) => a.id === "head");
  const tail = input.activityArc.find((a) => a.id === "tail");
  if (head && tail && head.messages > 0 && tail.messages > 0) {
    const ratio = round(tail.messages / head.messages, 2);
    if (ratio >= 1.25) out.push(`마지막 7일이 처음 7일보다 **${ratio}배** 활발 — 대화가 뜨거워지는 구간이 있었어요.`);
    else if (ratio <= 0.8) out.push(`처음 7일이 마지막보다 더 붐볐어요(후반은 처음의 **${Math.round(ratio * 100)}%** 수준).`);
  }
  if (input.lexicalTypeRichnessPercent !== null && input.lexicalTypeRichnessPercent >= 18)
    out.push(`본문 단어는 **${input.lexicalTypeRichnessPercent}%** 정도로 서로 다른 표현이 많이 섞였어요.`);
  const pace = input.conversationPace;
  out.push(`대화 템포는 **${pace.emoji} ${pace.label}** — ${pace.detail}`);
  const peakHidden = [...input.roomPulse].sort((a, b) => b.hidden - a.hidden)[0];
  if (peakHidden && peakHidden.hidden >= 5)
    out.push(`가림 알림이 가장 많았던 날은 **${formatDayMdHighlight(peakHidden.date)}**(${peakHidden.hidden}건)이에요.`);
  const peakJoin = [...input.roomPulse].sort((a, b) => b.join - a.join)[0];
  if (peakJoin && peakJoin.join >= 20)
    out.push(`입장이 가장 몰린 날은 **${formatDayMdHighlight(peakJoin.date)}** — **${peakJoin.join}**명 들어왔어요.`);
  return out.slice(0, 14);
}

/* ── 관계 추론 ── */

export function inferRoomRelationship(
  honorific: import("../types.js").HonorificInsight,
): import("../types.js").RoomRelationship {
  const honorificCount = honorific.participants.filter((p) => p.dominantStyle === "honorific").length;
  const casualCount = honorific.participants.filter((p) => p.dominantStyle === "casual").length;
  const total = honorific.participants.length;
  if (total === 0) return { type: "mixed", description: "높임법 분석 데이터가 부족합니다.", evidence: [] };
  const hRatio = honorificCount / total;
  const cRatio = casualCount / total;
  if (hRatio >= 0.7) return {
    type: "formal", description: "대부분 존칭을 사용하는 격식 있는 방입니다.",
    evidence: [`${honorificCount}명 중 ${Math.round(hRatio * 100)}%가 존칭 사용`],
  };
  if (cRatio >= 0.7) return {
    type: "friendly", description: "친구나 동료처럼 편안한 반말을 주로 사용합니다.",
    evidence: [`${casualCount}명 중 ${Math.round(cRatio * 100)}%가 반말 사용`],
  };
  if (honorificCount > 0 && casualCount > 0) return {
    type: "hierarchical", description: "존칭과 반말이 혼용되어 선후배/상하 관계가 있을 수 있습니다.",
    evidence: [`존칭 사용자: ${honorificCount}명`, `반말 사용자: ${casualCount}명`],
  };
  return {
    type: "mixed", description: "다양한 높임법 스타일이 혼재되어 있습니다.",
    evidence: ["명확한 패턴을 찾을 수 없음"],
  };
}
