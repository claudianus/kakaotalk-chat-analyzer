import { isNoiseKeyword } from "./keyword-quality.js";
const RRF_K = 60;
function rrf(rank) {
    return 1 / (RRF_K + rank);
}
/** BM25(score) + 시맨틱 supplement RRF 병합 */
export function mergeKeywordRankings(ranked, supplement, limit, semanticSupplementWeight = 0.85) {
    const bm25 = ranked
        .filter((item) => !isNoiseKeyword(item.label))
        .sort((a, b) => b.score - a.score ||
        b.messageHits - a.messageHits ||
        b.label.length - a.label.length ||
        a.label.localeCompare(b.label));
    const suppTop = supplement
        .topCounts(Math.max(8, Math.floor(limit / 5)))
        .filter((x) => !isNoiseKeyword(x.label));
    const fused = new Map();
    bm25.forEach((item, i) => {
        fused.set(item.label, {
            rrf: (fused.get(item.label)?.rrf ?? 0) + rrf(i + 1),
            messageHits: item.messageHits,
        });
    });
    suppTop.forEach((item, i) => {
        const prev = fused.get(item.label);
        fused.set(item.label, {
            rrf: (prev?.rrf ?? 0) + rrf(i + 1) * semanticSupplementWeight,
            messageHits: Math.max(prev?.messageHits ?? 0, item.count),
        });
    });
    return [...fused.entries()]
        .sort((a, b) => b[1].rrf - a[1].rrf ||
        b[1].messageHits - a[1].messageHits ||
        b[0].length - a[0].length ||
        a[0].localeCompare(b[0]))
        .slice(0, limit)
        .map(([label, meta]) => ({
        label,
        count: Math.max(meta.messageHits, 1),
    }));
}
//# sourceMappingURL=keyword-merge.js.map