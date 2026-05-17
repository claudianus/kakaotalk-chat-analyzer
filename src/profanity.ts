import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProfanityStats } from "./types.js";

const LEXICON_VERSION = "2026-05";

function lexiconPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "korean-profanity.txt");
}

export function profanityLexiconVersion(): string {
  return LEXICON_VERSION;
}

export function loadProfanityPatterns(): string[] {
  let raw: string;
  try {
    raw = readFileSync(lexiconPath(), "utf8");
  } catch {
    return [];
  }
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

/** 매칭용: 공백·제로폭 제거, 라틴 소문자 */
export function normalizeProfanityText(text: string): string {
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function countSubstring(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let pos = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, pos);
    if (idx < 0) break;
    count += 1;
    pos = idx + Math.max(1, needle.length);
  }
  return count;
}

interface SenderProfanity {
  hits: number;
  messages: number;
}

export class ProfanityCounter {
  private readonly patterns: string[];
  private totalHits = 0;
  private messagesWithProfanity = 0;
  private readonly bySender = new Map<string, SenderProfanity>();

  constructor(patterns: string[]) {
    this.patterns = patterns.map((p) => normalizeProfanityText(p)).filter((p) => p.length >= 2);
  }

  static create(): ProfanityCounter {
    return new ProfanityCounter(loadProfanityPatterns());
  }

  add(message: string, sender: string): void {
    if (this.patterns.length === 0) return;
    const normalized = normalizeProfanityText(message);
    if (normalized.length === 0) return;
    let hits = 0;
    for (const pattern of this.patterns) {
      hits += countSubstring(normalized, pattern);
    }
    if (hits <= 0) return;
    this.totalHits += hits;
    this.messagesWithProfanity += 1;
    const row = this.bySender.get(sender) ?? { hits: 0, messages: 0 };
    row.hits += hits;
    row.messages += 1;
    this.bySender.set(sender, row);
  }

  buildProfanityStats(
    totalMessages: number,
    aliasBySender: Map<string, string>,
  ): ProfanityStats {
    const topBySender = [...this.bySender.entries()]
      .map(([raw, stat]) => ({
        alias: aliasBySender.get(raw) ?? "???",
        hits: stat.hits,
        messages: stat.messages,
      }))
      .sort((a, b) => b.hits - a.hits || b.messages - a.messages)
      .slice(0, 8);
    const per100Messages =
      totalMessages > 0 ? Math.round((this.messagesWithProfanity / totalMessages) * 100 * 100) / 100 : 0;
    return {
      totalHits: this.totalHits,
      messagesWithProfanity: this.messagesWithProfanity,
      per100Messages,
      topBySender,
    };
  }
}

export function emptyProfanityStats(): ProfanityStats {
  return {
    totalHits: 0,
    messagesWithProfanity: 0,
    per100Messages: 0,
    topBySender: [],
  };
}
