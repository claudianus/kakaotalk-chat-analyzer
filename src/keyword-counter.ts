import type { CountItem } from "./types.js";

const MAX_KEYS = 24_000;
const PRUNE_TO = 18_000;

/** 키워드 맵 상한 + 전체 토큰 히트 수 추적(Top1 비중용) */
export class KeywordCounter {
  private readonly map = new Map<string, number>();
  private totalHits = 0;
  private maxCount = 0;

  add(token: string): void {
    this.addHits(token, 1);
  }

  addHits(token: string, hits: number): void {
    if (hits <= 0) return;
    this.totalHits += hits;
    const next = (this.map.get(token) ?? 0) + hits;
    this.map.set(token, next);
    if (next > this.maxCount) this.maxCount = next;
    if (this.map.size > MAX_KEYS) this.prune();
  }

  topCounts(limit: number): CountItem[] {
    return [...this.map.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort(
        (a, b) =>
          b.count - a.count || b.label.length - a.label.length || a.label.localeCompare(b.label),
      )
      .slice(0, limit);
  }

  top1SharePercent(): number | null {
    if (this.totalHits === 0) return null;
    const factor = 10;
    return Math.round((this.maxCount / this.totalHits) * 100 * factor) / factor;
  }

  /** 서로 다른 토큰 수 ÷ 전체 토큰 히트(%) — 높을수록 어휘가 분산됨 */
  typeTokenRichnessPercent(): number | null {
    if (this.totalHits === 0) return null;
    return Math.round((this.map.size / this.totalHits) * 1000) / 10;
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
