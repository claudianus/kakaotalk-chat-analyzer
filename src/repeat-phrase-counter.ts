import type { CountItem, RepeatedPhraseStat } from "./types.js";

const MAX_ENTRIES = 4000;
const PRUNE_TO = 2500;

/** 동일 본문 반복(환영문·복붙 문구) — 상한 맵 + 일별 피크 */
export class RepeatPhraseCounter {
  private readonly map = new Map<string, number>();
  private readonly dailyByPhrase = new Map<string, Map<string, number>>();

  add(text: string, dayKey?: string): void {
    const n = text.trim().replace(/\s+/g, " ");
    if (n.length < 12 || n.length > 180) return;
    this.map.set(n, (this.map.get(n) ?? 0) + 1);
    if (dayKey) {
      let daily = this.dailyByPhrase.get(n);
      if (!daily) {
        daily = new Map();
        this.dailyByPhrase.set(n, daily);
      }
      daily.set(dayKey, (daily.get(dayKey) ?? 0) + 1);
    }
    if (this.map.size > MAX_ENTRIES) this.prune();
  }

  peakDate(label: string): string | undefined {
    const daily = this.dailyByPhrase.get(label);
    if (!daily || daily.size === 0) return undefined;
    return [...daily.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  }

  top(limit: number, minCount: number): RepeatedPhraseStat[] {
    return [...this.map.entries()]
      .filter(([, c]) => c >= minCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([label, count]) => ({
        label: label.length > 72 ? `${label.slice(0, 69)}…` : label,
        count,
        peakDate: this.peakDate(label),
      }));
  }

  /** @deprecated use top() */
  topCounts(limit: number, minCount: number): CountItem[] {
    return this.top(limit, minCount).map(({ label, count }) => ({ label, count }));
  }

  private prune(): void {
    const kept = [...this.map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, PRUNE_TO);
    const keptLabels = new Set(kept.map(([k]) => k));
    this.map.clear();
    for (const [k, v] of kept) this.map.set(k, v);
    for (const key of [...this.dailyByPhrase.keys()]) {
      if (!keptLabels.has(key)) this.dailyByPhrase.delete(key);
    }
  }
}
