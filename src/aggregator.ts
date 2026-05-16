import { formatDate, formatDateTime, partsToUtcMs, weekdayIndex } from "./date.js";
import type {
  ChatRecord,
  CountItem,
  EncodingName,
  ParticipantStat,
  ParsedDateParts,
  PrivacyMode,
  ReportData,
  ReportInsights,
} from "./types.js";
import { maskPartialDisplayName, parseChatRoomNameFromExportPath, safeInputName } from "./analysis-labels.js";
import { GapStreamStats } from "./gap-stats.js";
import { KeywordCounter } from "./keyword-counter.js";

const ATTACHMENT_MARKERS = [
  "사진",
  "동영상",
  "파일",
  "이모티콘",
  "지도",
  "연락처",
  "투표",
  "공유",
  "음성메시지",
  "삭제된 메시지",
] as const;

const KEYWORD_EXCLUDE = new Set<string>(ATTACHMENT_MARKERS);
const WEEKDAY_LABELS_KO = ["일", "월", "화", "수", "목", "금", "토"];
const URL_RE = /\bhttps?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /\b(?:\+?\d[\d\s().-]{7,}\d)\b/g;
const TOKEN_RE = /[가-힣A-Za-z][가-힣A-Za-z0-9_+-]{1,}/g;

const STOPWORDS = new Set([
  "그리고",
  "그냥",
  "근데",
  "그래서",
  "저는",
  "제가",
  "우리",
  "오늘",
  "내일",
  "어제",
  "이거",
  "저거",
  "그거",
  "수정",
  "확인",
  "가능",
  "입니다",
  "합니다",
  "있습니다",
  "없는",
  "있는",
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "from",
  "http",
  "https",
]);

const NIGHT_HOURS = new Set([23, 0, 1, 2, 3, 4, 5]);
const EMOJI_RE = /\p{Extended_Pictographic}/u;
const LINK_HINT_RE = /https?:\/\/|www\./i;
const HAS_TOKEN_CHAR_RE = /[가-힣A-Za-z]/;

export interface FinalizeSourceMeta {
  filePath: string;
  encoding: EncodingName;
  physicalLines: number;
  warningCount: number;
}

interface MutableParticipantStat {
  messages: number;
  characters: number;
  attachmentMessages: number;
  linkMessages: number;
  nightMessages: number;
  maxConsecutive: number;
}

export class ReportAggregator {
  private readonly filePath: string;
  private readonly privacy: PrivacyMode;
  private readonly top: number;

  private readonly senderStats = new Map<string, MutableParticipantStat>();
  private readonly senderNamesNormalized = new Set<string>();
  private readonly sendersRegistered = new Set<string>();
  private readonly daily = new Map<string, number>();
  private readonly monthly = new Map<string, number>();
  private readonly hourly = Array.from({ length: 24 }, () => 0);
  private readonly weekdays = Array.from({ length: 7 }, () => 0);
  private readonly attachments = new Map<string, number>();
  private readonly domains = new Map<string, number>();
  private readonly keywordCounter = new KeywordCounter();
  private readonly gapStats = new GapStreamStats();

  private total = 0;
  private totalCharacters = 0;
  private messagesWithLinks = 0;
  private messagesWithAttachments = 0;
  private nightMessages = 0;
  private emojiMessages = 0;
  private weekendMessages = 0;
  private questionMessages = 0;
  private speakerSwitches = 0;
  private monologueMessages = 0;

  private prevMs: number | null = null;
  private prevSender: string | null = null;
  private runSender: string | null = null;
  private runLen = 0;
  private firstDate: ParsedDateParts | null = null;
  private lastDate: ParsedDateParts | null = null;

  constructor(filePath: string, privacy: PrivacyMode, top: number) {
    this.filePath = filePath;
    this.privacy = privacy;
    this.top = top;
  }

  consume(record: ChatRecord): void {
    if (this.prevSender !== null && record.sender !== this.prevSender) {
      this.speakerSwitches += 1;
    }

    const stat = getParticipantStat(this.senderStats, record.sender);
    if (!this.sendersRegistered.has(record.sender)) {
      this.sendersRegistered.add(record.sender);
      this.senderNamesNormalized.add(normalizeToken(record.sender));
    }

    const msg = record.message;
    const messageLength = msg.length;
    const foundAttachments = getAttachmentMarkers(msg);
    const foundDomains = LINK_HINT_RE.test(msg) ? getDomains(msg) : [];
    const ms = partsToUtcMs(record.date);

    if (this.firstDate === null) this.firstDate = record.date;
    this.lastDate = record.date;
    this.total += 1;

    if (messageLength > 0 && EMOJI_RE.test(msg)) {
      this.emojiMessages += 1;
    }

    if (msg.includes("?") || msg.includes("？")) {
      this.questionMessages += 1;
    }

    const wi = weekdayIndex(record.date);
    if (wi === 0 || wi === 6) {
      this.weekendMessages += 1;
    }

    if (NIGHT_HOURS.has(record.date.hour)) {
      this.nightMessages += 1;
      stat.nightMessages += 1;
    }

    if (this.prevMs !== null) {
      const delta = ms - this.prevMs;
      this.gapStats.add(delta);
    }
    this.prevMs = ms;

    if (record.sender === this.prevSender) {
      this.runLen += 1;
      if (this.runLen >= 3) {
        this.monologueMessages += 1;
      }
    } else {
      if (this.prevSender !== null && this.runSender !== null) {
        const prevStat = getParticipantStat(this.senderStats, this.prevSender);
        prevStat.maxConsecutive = Math.max(prevStat.maxConsecutive, this.runLen);
      }
      this.runSender = record.sender;
      this.runLen = 1;
    }
    this.prevSender = record.sender;

    stat.messages += 1;
    stat.characters += messageLength;
    this.totalCharacters += messageLength;

    if (foundAttachments.length > 0) {
      stat.attachmentMessages += 1;
      this.messagesWithAttachments += 1;
      for (const marker of foundAttachments) increment(this.attachments, marker);
    }

    if (foundDomains.length > 0) {
      stat.linkMessages += 1;
      this.messagesWithLinks += 1;
      for (const domain of foundDomains) increment(this.domains, domain);
    }

    if (
      messageLength >= 2 &&
      HAS_TOKEN_CHAR_RE.test(msg) &&
      shouldExtractKeywords(msg, foundAttachments)
    ) {
      for (const keyword of extractKeywords(msg, this.senderNamesNormalized)) {
        this.keywordCounter.add(keyword);
      }
    }

    const dayKey = formatDate(record.date);
    increment(this.daily, dayKey);
    increment(this.monthly, `${record.date.year}-${pad2(record.date.month)}`);
    this.hourly[record.date.hour] = (this.hourly[record.date.hour] ?? 0) + 1;
    this.weekdays[wi] = (this.weekdays[wi] ?? 0) + 1;
  }

  finalize(meta: FinalizeSourceMeta): ReportData {
    if (this.prevSender !== null && this.runSender !== null) {
      const prevStat = getParticipantStat(this.senderStats, this.prevSender);
      prevStat.maxConsecutive = Math.max(prevStat.maxConsecutive, this.runLen);
    }

    const total = this.total;
    const aliases = buildSenderLabels([...this.senderStats.keys()], this.privacy);
    const participantStats = [...this.senderStats.entries()]
      .map(([raw, stat]): ParticipantStat => {
        const sharePercent = total > 0 ? round((stat.messages / total) * 100, 1) : 0;
        return {
          alias: aliases.get(raw) ?? "???",
          messages: stat.messages,
          characters: stat.characters,
          averageLength: round(stat.characters / Math.max(stat.messages, 1), 1),
          attachmentMessages: stat.attachmentMessages,
          linkMessages: stat.linkMessages,
          sharePercent,
          nightMessages: stat.nightMessages,
          maxConsecutive: stat.maxConsecutive,
        };
      })
      .sort((a, b) => b.messages - a.messages)
      .slice(0, this.top);

    const sortedDays = [...this.daily.keys()].sort();
    const longestStreak = longestDateStreak(sortedDays);
    let peakHour: number | null = null;
    let peakCount = -1;
    for (let h = 0; h < 24; h += 1) {
      const c = this.hourly[h] ?? 0;
      if (c > peakCount) {
        peakCount = c;
        peakHour = h;
      }
    }
    if (peakCount <= 0) peakHour = null;

    let busiestIdx = -1;
    let busiestCount = -1;
    for (let i = 0; i < 7; i += 1) {
      const c = this.weekdays[i] ?? 0;
      if (c > busiestCount) {
        busiestCount = c;
        busiestIdx = i;
      }
    }
    const busiestWeekdayLabel =
      busiestIdx >= 0 && busiestCount > 0 ? `${WEEKDAY_LABELS_KO[busiestIdx] ?? ""}요일` : null;

    const medianMs = this.gapStats.medianMs();
    const medianReplyGapMinutes = medianMs !== null ? round(medianMs / 60_000, 1) : null;

    const nightSharePercent = total > 0 ? round((this.nightMessages / total) * 100, 1) : 0;
    const activeDays = this.daily.size;
    const messagesPerActiveDay = activeDays > 0 ? round(total / activeDays, 1) : 0;

    const allMessageCounts = [...this.senderStats.values()].map((s) => s.messages).sort((a, b) => a - b);
    const participantGini = computeGini(allMessageCounts);
    const p90Ms = this.gapStats.p90Ms();
    const replyGapP90Minutes = p90Ms !== null ? round(p90Ms / 60_000, 1) : null;
    const maxSilenceBetweenActiveDays = maxSilenceGapDays(sortedDays);
    const top3ParticipantSharePercent = computeTop3Share(this.senderStats, total);
    const linkDomainEntropyBits = domainEntropyBits(this.domains);
    const densityMessagesPerCalendarDay = computeDensityFromSpan(this.firstDate, this.lastDate, total);
    const weekendSharePercent = total > 0 ? round((this.weekendMessages / total) * 100, 1) : 0;
    const questionLikeMessagesPer100 = total > 0 ? round((this.questionMessages / total) * 100, 2) : 0;
    const speakerSwitchRatePer100 = total > 0 ? round((this.speakerSwitches / total) * 100, 2) : 0;
    const daypartPercents = computeDaypartPercents(this.hourly, total);
    const rhythmScore = computeRhythmScore({
      gini: participantGini,
      longestStreak,
      density: densityMessagesPerCalendarDay,
    });

    const linksPer100 = total > 0 ? round((this.messagesWithLinks / total) * 100, 2) : 0;
    const attachmentsPer100 = total > 0 ? round((this.messagesWithAttachments / total) * 100, 2) : 0;
    const perParticipantMsgs = [...this.senderStats.values()].map((s) => s.messages);
    const medianMessagesPerParticipant =
      perParticipantMsgs.length > 0
        ? round(medianSorted([...perParticipantMsgs].sort((a, b) => a - b)), 2)
        : null;
    const burstGapUnder1mPercent = this.gapStats.burstUnder1mPercent();
    const gapOver60mPercent = this.gapStats.gapOver60mPercent();
    let activeHoursCount = 0;
    for (let h = 0; h < 24; h += 1) {
      if ((this.hourly[h] ?? 0) > 0) activeHoursCount += 1;
    }
    const keywordTop1SharePercent = this.keywordCounter.top1SharePercent();
    let attachmentMarkerSum = 0;
    for (const c of this.attachments.values()) attachmentMarkerSum += c;
    const photoMarkerCount = this.attachments.get("사진") ?? 0;
    const photoShareOfAllAttachmentMarkers =
      attachmentMarkerSum > 0 ? round((photoMarkerCount / attachmentMarkerSum) * 100, 1) : null;
    let maxDayMessages = 0;
    for (const c of this.daily.values()) maxDayMessages = Math.max(maxDayMessages, c);
    const peakDaySharePercent = total > 0 ? round((maxDayMessages / total) * 100, 1) : 0;
    const uniqueDomainCount = this.domains.size;
    const replyGapCoeffVariation = this.gapStats.coeffVariation();
    const monologueMessagesPercent = total > 0 ? round((this.monologueMessages / total) * 100, 1) : 0;

    const insights: ReportInsights = {
      weekendSharePercent,
      participantGini,
      replyGapP90Minutes,
      maxSilenceBetweenActiveDays,
      top3ParticipantSharePercent,
      linkDomainEntropyBits,
      densityMessagesPerCalendarDay,
      questionLikeMessagesPer100,
      speakerSwitchRatePer100,
      rhythmScore,
      daypartPercents,
      linksPer100,
      attachmentsPer100,
      medianMessagesPerParticipant,
      burstGapUnder1mPercent,
      gapOver60mPercent,
      activeHoursCount,
      keywordTop1SharePercent,
      photoShareOfAllAttachmentMarkers,
      monologueMessagesPercent,
      peakDaySharePercent,
      uniqueDomainCount,
      replyGapCoeffVariation,
    };

    const highlights = buildHighlights({
      total,
      topAlias: participantStats[0]?.alias ?? null,
      topShare: participantStats[0]?.sharePercent ?? null,
      busiestWeekdayLabel,
      peakHour,
      medianReplyGapMinutes,
      nightSharePercent,
      longestStreak,
      emojiMessages: this.emojiMessages,
      messagesWithAttachments: this.messagesWithAttachments,
      weekendSharePercent,
      participantGini,
      replyGapP90Minutes,
      maxSilenceBetweenActiveDays,
      rhythmScore,
      burstGapUnder1mPercent,
      monologueMessagesPercent,
    });

    return {
      generatedAt: new Date().toISOString(),
      privacy: this.privacy,
      source: {
        fileName: safeInputName(meta.filePath),
        chatRoomName: parseChatRoomNameFromExportPath(meta.filePath),
        encoding: meta.encoding,
        physicalLines: meta.physicalLines,
        warnings: meta.warningCount,
      },
      summary: {
        totalMessages: total,
        participants: aliases.size,
        activeDays,
        firstMessage: this.firstDate ? formatDateTime(this.firstDate) : null,
        lastMessage: this.lastDate ? formatDateTime(this.lastDate) : null,
        averageMessageLength: round(this.totalCharacters / Math.max(total, 1), 1),
        messagesWithLinks: this.messagesWithLinks,
        messagesWithAttachments: this.messagesWithAttachments,
        messagesPerActiveDay,
        longestActiveStreakDays: longestStreak,
        peakHour,
        busiestWeekdayLabel,
        medianReplyGapMinutes,
        nightSharePercent,
        emojiMessages: this.emojiMessages,
      },
      insights,
      participants: participantStats,
      daily: [...this.daily.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
      hourly: this.hourly,
      weekdays: this.weekdays.map((count, index) => ({
        label: `${WEEKDAY_LABELS_KO[index] ?? index}요일`,
        count,
      })),
      monthly: [...this.monthly.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
      attachments: topCounts(this.attachments, this.top),
      domains: topCounts(this.domains, this.top),
      keywords: this.keywordCounter.topCounts(this.top),
      highlights,
    };
  }
}

function buildSenderLabels(senders: string[], privacy: PrivacyMode): Map<string, string> {
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

function getParticipantStat(stats: Map<string, MutableParticipantStat>, sender: string): MutableParticipantStat {
  const existing = stats.get(sender);
  if (existing) return existing;
  const created: MutableParticipantStat = {
    messages: 0,
    characters: 0,
    attachmentMessages: 0,
    linkMessages: 0,
    nightMessages: 0,
    maxConsecutive: 0,
  };
  stats.set(sender, created);
  return created;
}

function shouldExtractKeywords(message: string, attachmentMarkers: string[]): boolean {
  const trimmed = message.trim();
  if (trimmed.length === 0) return false;
  if (attachmentMarkers.length === 1 && trimmed === attachmentMarkers[0]) return false;
  if (attachmentMarkers.length > 0 && trimmed.length <= 16) {
    const onlyMarkers = attachmentMarkers.every((m) => trimmed === m || trimmed.includes(m));
    if (onlyMarkers && !/[가-힣A-Za-z]{3,}/.test(trimmed.replace(/[^\p{L}\p{N}]/gu, ""))) {
      return false;
    }
  }
  return true;
}

function getAttachmentMarkers(message: string): string[] {
  return ATTACHMENT_MARKERS.filter((marker) => message.includes(marker));
}

function getDomains(message: string): string[] {
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

function extractKeywords(message: string, senderNames: Set<string>): string[] {
  const withoutSensitivePatterns = message
    .replace(URL_RE, " ")
    .replace(EMAIL_RE, " ")
    .replace(PHONE_RE, " ");
  const tokens = withoutSensitivePatterns.match(TOKEN_RE) ?? [];
  const keywords: string[] = [];
  for (const token of tokens) {
    const normalized = normalizeToken(token);
    if (!normalized) continue;
    if (normalized.length < 2 || normalized.length > 30) continue;
    if (STOPWORDS.has(normalized)) continue;
    if (senderNames.has(normalized)) continue;
    if (KEYWORD_EXCLUDE.has(normalized)) continue;
    if (/^\d+$/.test(normalized)) continue;
    keywords.push(normalized);
  }
  return keywords;
}

function normalizeToken(token: string): string {
  return /^[A-Za-z0-9_+-]+$/.test(token) ? token.toLowerCase() : token.trim();
}

function increment(map: Map<string, number>, key: string, amount = 1): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function topCounts(map: Map<string, number>, limit: number): CountItem[] {
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function medianSorted(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function longestDateStreak(sortedYmd: string[]): number {
  if (sortedYmd.length === 0) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sortedYmd.length; i += 1) {
    const a = new Date(`${sortedYmd[i - 1]}T12:00:00Z`).getTime();
    const b = new Date(`${sortedYmd[i]}T12:00:00Z`).getTime();
    const diffDays = Math.round((b - a) / 86_400_000);
    if (diffDays === 1) {
      cur += 1;
      best = Math.max(best, cur);
    } else {
      cur = 1;
    }
  }
  return best;
}

function computeGini(counts: number[]): number | null {
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

function maxSilenceGapDays(sortedYmd: string[]): number | null {
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

function computeTop3Share(stats: Map<string, MutableParticipantStat>, total: number): number {
  if (total === 0) return 0;
  const top3 = [...stats.values()]
    .map((s) => s.messages)
    .sort((a, b) => b - a)
    .slice(0, 3)
    .reduce((a, c) => a + c, 0);
  return round((top3 / total) * 100, 1);
}

function domainEntropyBits(domains: Map<string, number>): number | null {
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

function computeDensityFromSpan(
  first: ParsedDateParts | null,
  last: ParsedDateParts | null,
  total: number,
): number | null {
  if (total === 0 || !first || !last) return null;
  const spanDays = Math.max(1, Math.floor((partsToUtcMs(last) - partsToUtcMs(first)) / 86_400_000) + 1);
  return round(total / spanDays, 2);
}

function computeDaypartPercents(
  hourly: number[],
  total: number,
): { key: string; label: string; percent: number }[] {
  const bands = [
    { key: "dawn", label: "새벽(0~5시)", lo: 0, hi: 5 },
    { key: "morning", label: "오전(6~11시)", lo: 6, hi: 11 },
    { key: "afternoon", label: "오후(12~17시)", lo: 12, hi: 17 },
    { key: "evening", label: "저녁(18~23시)", lo: 18, hi: 23 },
  ] as const;
  if (total === 0) {
    return bands.map((b) => ({ key: b.key, label: b.label, percent: 0 }));
  }
  const raw = bands.map((b) => {
    let c = 0;
    for (let h = b.lo; h <= b.hi; h += 1) c += hourly[h] ?? 0;
    return { key: b.key, label: b.label, count: c };
  });
  const sum = raw.reduce((a, x) => a + x.count, 0) || 1;
  let rounded = raw.map((x) => ({
    key: x.key,
    label: x.label,
    percent: round((x.count / sum) * 100, 1),
  }));
  const drift = 100 - rounded.reduce((a, x) => a + x.percent, 0);
  if (Math.abs(drift) >= 0.05 && rounded.length > 0) {
    const idx = rounded.reduce((best, x, i, arr) => (x.percent >= arr[best]!.percent ? i : best), 0);
    rounded = rounded.map((x, i) => (i === idx ? { ...x, percent: round(x.percent + drift, 1) } : x));
  }
  return rounded;
}

function computeRhythmScore(input: {
  gini: number | null;
  longestStreak: number;
  density: number | null;
}): number {
  const g = input.gini ?? 0.45;
  const streakN = Math.min(1, input.longestStreak / 28);
  const densityN = input.density != null ? Math.min(1, input.density / 40) : 0.25;
  const score = 48 * (1 - Math.min(0.95, g)) + 32 * streakN + 20 * densityN;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildHighlights(input: {
  total: number;
  topAlias: string | null;
  topShare: number | null;
  busiestWeekdayLabel: string | null;
  peakHour: number | null;
  medianReplyGapMinutes: number | null;
  nightSharePercent: number;
  longestStreak: number;
  emojiMessages: number;
  messagesWithAttachments: number;
  weekendSharePercent: number;
  participantGini: number | null;
  replyGapP90Minutes: number | null;
  maxSilenceBetweenActiveDays: number | null;
  rhythmScore: number;
  burstGapUnder1mPercent: number | null;
  monologueMessagesPercent: number;
}): string[] {
  const out: string[] = [];
  if (input.topAlias && input.topShare !== null && input.total > 0) {
    out.push(`가장 말이 많았던 분은 **${input.topAlias}** (전체의 **${input.topShare}%**).`);
  }
  if (input.busiestWeekdayLabel) {
    out.push(`요일별로는 **${input.busiestWeekdayLabel}**에 활동이 가장 활발했어요.`);
  }
  if (input.peakHour !== null) {
    out.push(`시간대는 **${input.peakHour}시**대에 메시지가 가장 몰렸습니다.`);
  }
  if (input.medianReplyGapMinutes !== null) {
    out.push(`연속 메시지 사이 간격의 중앙값은 약 **${input.medianReplyGapMinutes}분**이에요.`);
  }
  if (input.nightSharePercent > 0) {
    out.push(`심야(23~05시) 메시지 비중은 **${input.nightSharePercent}%**입니다.`);
  }
  if (input.longestStreak > 1) {
    out.push(`하루도 빠짐없이 이어진 최장 **${input.longestStreak}일** 연속 활동 기록이 있어요.`);
  }
  if (input.emojiMessages > 0) {
    out.push(`이모지·스티커 느낌의 메시지는 **${input.emojiMessages}**건 정도 감지됐어요.`);
  }
  if (input.messagesWithAttachments > 0) {
    out.push(`사진·파일·동영상 등 첨부가 들어간 메시지는 **${input.messagesWithAttachments}**건입니다.`);
  }
  if (input.total > 0 && input.weekendSharePercent > 0) {
    out.push(`주말(토·일) 메시지 비중은 **${input.weekendSharePercent}%**예요.`);
  }
  if (input.participantGini !== null && input.participantGini >= 0.35) {
    out.push(`참여도는 소수에게 조금 몰린 편이에요(Gini **${input.participantGini}** 근처).`);
  }
  if (input.replyGapP90Minutes !== null && input.replyGapP90Minutes >= 30) {
    out.push(`가끔 긴 침묵도 있어요 — 응답 간격 **상위 10%**가 약 **${input.replyGapP90Minutes}분** 이상입니다.`);
  }
  if (input.maxSilenceBetweenActiveDays !== null && input.maxSilenceBetweenActiveDays >= 7) {
    out.push(`활동일 사이 최대 **${input.maxSilenceBetweenActiveDays}일** 동안은 메시지가 끊긴 구간이 있었어요.`);
  }
  if (input.rhythmScore >= 65) {
    out.push(`종합 **리듬 점수**는 **${input.rhythmScore}/100** — 꾸준하고 균형 잡힌 페이스에 가깝습니다.`);
  }
  if (input.burstGapUnder1mPercent !== null && input.burstGapUnder1mPercent >= 40) {
    out.push(`응답 간격의 **${input.burstGapUnder1mPercent}%**가 1분 이내로, 실시간 대화 톤이 강해요.`);
  }
  if (input.monologueMessagesPercent >= 25) {
    out.push(`같은 사람 **3연속 이상** 메시지가 전체의 **${input.monologueMessagesPercent}%** — 긴 설명·정리 구간이 잦을 수 있어요.`);
  }
  return out.slice(0, 12);
}
