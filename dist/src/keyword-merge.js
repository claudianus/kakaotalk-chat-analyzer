/** KR-WordRank 점수 우선 + 미등록 해시태그·슬랭만 보조 */
export function mergeKeywordRankings(wordRank, supplement, limit) {
    const ranked = [...wordRank.entries()].sort((a, b) => b[1] - a[1]);
    const peak = ranked[0]?.[1] ?? 1;
    const items = ranked.slice(0, limit).map(([label, score]) => ({
        label,
        count: Math.max(1, Math.round((score / peak) * 10_000)),
    }));
    const floor = items[items.length - 1]?.count ?? 1;
    const seen = new Set(items.map((i) => i.label));
    for (const { label, count } of supplement.topCounts(Math.max(6, Math.floor(limit / 4)))) {
        if (seen.has(label))
            continue;
        items.push({ label, count: Math.min(count, floor) });
        seen.add(label);
    }
    return items
        .sort((a, b) => b.count - a.count || b.label.length - a.label.length || a.label.localeCompare(b.label))
        .slice(0, limit);
}
//# sourceMappingURL=keyword-merge.js.map