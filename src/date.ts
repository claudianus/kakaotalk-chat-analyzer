import type { ParsedDateParts } from "./types.js";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

export function parseKakaoDate(raw: string): ParsedDateParts | null {
  const match = DATE_RE.exec(raw);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
}

export function formatDateTime(parts: ParsedDateParts): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)} ${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`;
}

export function formatDate(parts: ParsedDateParts): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function weekdayIndex(parts: ParsedDateParts): number {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

/** UTC 기준 타임스탬프(ms). 연속 일수·응답 간격 계산에 사용합니다. */
export function partsToUtcMs(parts: ParsedDateParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}
