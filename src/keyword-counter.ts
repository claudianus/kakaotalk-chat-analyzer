import type { CountItem } from "./types.js";

const MAX_KEYS = 24_000;
const PRUNE_TO = 18_000;

/** 키워드 맵 상한 + 전체 토큰 히트 수 추적(Top1 비중용) */
export class KeywordCounter {
  private readonly map = new Map<string, number>();
  private totalHits = 0;
  private maxCount = 0;

  add(token: string): void {
    this.totalHits += 1;
    const next = (this.map.get(token) ?? 0) + 1;
    this.map.set(token, next);
    if (next > this.maxCount) this.maxCount = next;
    if (this.map.size > MAX_KEYS) this.prune();
  }

  topCounts(limit: number): CountItem[] {
    return [...this.map.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, limit);
  }

  top1SharePercent(): number | null {
    if (this.totalHits === 0) return null;
    const factor = 10;
    return Math.round((this.maxCount / this.totalHits) * 100 * factor) / factor;
  }

  private prune(): void {
    const kept = [...this.map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, PRUNE_TO);
    this.map.clear();
    this.maxCount = 0;
    for (const [label, count] of kept) {
      this.map.set(label, count);
      if (count > this.maxCount) this.maxCount = count;
    }
  }
}
