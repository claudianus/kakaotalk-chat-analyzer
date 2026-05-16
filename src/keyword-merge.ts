import type { KeywordRankItem } from "./kr-wordrank-stream.js";
import type { CountItem } from "./types.js";
import type { KeywordCounter } from "./keyword-counter.js";

/** KR-WordRank 점수 순 + 실제 메시지 등장 횟수(count) */
export function mergeKeywordRankings(
  ranked: KeywordRankItem[],
  supplement: KeywordCounter,
  limit: number,
): CountItem[] {
  const items: CountItem[] = ranked.slice(0, limit).map((item) => ({
    label: item.label,
    count: Math.max(item.messageHits, 1),
  }));

  const floor = items[items.length - 1]?.count ?? 1;
  const seen = new Set(items.map((i) => i.label));
  for (const { label, count } of supplement.topCounts(Math.max(8, Math.floor(limit / 5)))) {
    if (seen.has(label)) continue;
    items.push({ label, count: Math.min(count, floor) });
    seen.add(label);
  }

  return items
    .sort((a, b) => b.count - a.count || b.label.length - a.label.length || a.label.localeCompare(b.label))
    .slice(0, limit);
}
