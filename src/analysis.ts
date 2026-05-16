import { basename } from "node:path";
import { formatDate, formatDateTime, weekdayIndex } from "./date.js";
import type { ChatRecord, CountItem, ParticipantStat, ParseResult, PrivacyMode, ReportData } from "./types.js";

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

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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

export function buildReportData(result: ParseResult, options?: { privacy?: PrivacyMode; top?: number }): ReportData {
  const top = options?.top ?? 30;
  const privacy = options?.privacy ?? "public-anonymous";
  const aliases = createAliases(result.records);
  const senderStats = new Map<string, MutableParticipantStat>();
  const daily = new Map<string, number>();
  const hourly = Array.from({ length: 24 }, () => 0);
  const weekdays = Array.from({ length: 7 }, () => 0);
  const attachments = new Map<string, number>();
  const domains = new Map<string, number>();
  const keywords = new Map<string, number>();
  const senderNames = new Set(result.records.map((record) => normalizeToken(record.sender)));

  let totalCharacters = 0;
  let messagesWithLinks = 0;
  let messagesWithAttachments = 0;

  for (const record of result.records) {
    const alias = aliases.get(record.sender) ?? "User ???";
    const stat = getParticipantStat(senderStats, alias);
    const messageLength = record.message.length;
    const foundAttachments = getAttachmentMarkers(record.message);
    const foundDomains = getDomains(record.message);

    stat.messages += 1;
    stat.characters += messageLength;
    totalCharacters += messageLength;

    if (foundAttachments.length > 0) {
      stat.attachmentMessages += 1;
      messagesWithAttachments += 1;
      for (const marker of foundAttachments) increment(attachments, marker);
    }

    if (foundDomains.length > 0) {
      stat.linkMessages += 1;
      messagesWithLinks += 1;
      for (const domain of foundDomains) increment(domains, domain);
    }

    for (const keyword of extractKeywords(record.message, senderNames)) {
      increment(keywords, keyword);
    }

    increment(daily, formatDate(record.date));
    hourly[record.date.hour] = (hourly[record.date.hour] ?? 0) + 1;
    weekdays[weekdayIndex(record.date)] = (weekdays[weekdayIndex(record.date)] ?? 0) + 1;
  }

  const participantStats = [...senderStats.values()]
    .map((stat): ParticipantStat => ({
      alias: stat.alias,
      messages: stat.messages,
      characters: stat.characters,
      averageLength: round(stat.characters / Math.max(stat.messages, 1), 1),
      attachmentMessages: stat.attachmentMessages,
      linkMessages: stat.linkMessages,
    }))
    .sort((a, b) => b.messages - a.messages)
    .slice(0, top);

  return {
    generatedAt: new Date().toISOString(),
    privacy,
    source: {
      fileName: "KakaoTalk export",
      encoding: result.encoding,
      physicalLines: result.physicalLines,
      warnings: result.warnings.length,
    },
    summary: {
      totalMessages: result.records.length,
      participants: aliases.size,
      activeDays: daily.size,
      firstMessage: result.records[0] ? formatDateTime(result.records[0].date) : null,
      lastMessage: result.records.at(-1) ? formatDateTime(result.records.at(-1)!.date) : null,
      averageMessageLength: round(totalCharacters / Math.max(result.records.length, 1), 1),
      messagesWithLinks,
      messagesWithAttachments,
    },
    participants: participantStats,
    daily: [...daily.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
    hourly,
    weekdays: weekdays.map((count, index) => ({ label: WEEKDAY_LABELS[index] ?? String(index), count })),
    attachments: topCounts(attachments, top),
    domains: topCounts(domains, top),
    keywords: topCounts(keywords, top),
  };
}

export function safeInputName(filePath: string): string {
  const name = basename(filePath);
  return name.length > 80 ? `${name.slice(0, 77)}...` : name;
}

interface MutableParticipantStat {
  alias: string;
  messages: number;
  characters: number;
  attachmentMessages: number;
  linkMessages: number;
}

function createAliases(records: ChatRecord[]): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const record of records) {
    if (!aliases.has(record.sender)) {
      aliases.set(record.sender, `User ${String(aliases.size + 1).padStart(3, "0")}`);
    }
  }
  return aliases;
}

function getParticipantStat(stats: Map<string, MutableParticipantStat>, alias: string): MutableParticipantStat {
  const existing = stats.get(alias);
  if (existing) return existing;

  const created = {
    alias,
    messages: 0,
    characters: 0,
    attachmentMessages: 0,
    linkMessages: 0,
  };
  stats.set(alias, created);
  return created;
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
