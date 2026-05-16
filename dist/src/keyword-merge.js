import { isNoiseKeyword } from "./keyword-quality.js";
/** TF-IDF 점수 순 + 메시지 등장 횟수(count) */
export function mergeKeywordRankings(ranked, supplement, limit) {
    const items = ranked
        .filter((item) => !isNoiseKeyword(item.label))
        .slice(0, limit)
        .map((item) => ({
        label: item.label,
        count: Math.max(item.messageHits, 1),
    }));
    const floor = items[items.length - 1]?.count ?? 1;
    const seen = new Set(items.map((i) => i.label));
    for (const { label, count } of supplement.topCounts(Math.max(8, Math.floor(limit / 5)))) {
        if (seen.has(label) || isNoiseKeyword(label))
            continue;
        items.push({ label, count: Math.min(count, floor) });
        seen.add(label);
    }
    return items
        .sort((a, b) => b.count - a.count || b.label.length - a.label.length || a.label.localeCompare(b.label))
        .slice(0, limit);
}
//# sourceMappingURL=keyword-merge.js.map