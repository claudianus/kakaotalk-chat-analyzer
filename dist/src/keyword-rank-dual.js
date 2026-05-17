import { isNoiseKeyword } from "./keyword-quality.js";
const RRF_K = 60;
const FREQ_WEIGHT = 0.55;
const BM25_WEIGHT = 0.45;
function rrf(rank) {
    return 1 / (RRF_K + rank);
}
/** 코퍼스 규모별 dual-lane 상한 */
export function keywordLaneCaps(messageCount, outputLimit) {
    const n = Math.max(messageCount, 1);
    const freqCap = n >= 50_000 ? 80 : n >= 10_000 ? 60 : n >= 2_000 ? 48 : 32;
    const bm25Cap = Math.min(200, Math.floor(80 + Math.sqrt(n)));
    return { freqCap, bm25Cap, outputLimit };
}
function normLogHits(hits, maxHits) {
    if (maxHits <= 0)
        return 0;
    return Math.log1p(hits) / Math.log1p(maxHits);
}
function normScore(score, maxScore) {
    if (maxScore <= 0)
        return 0;
    return score / maxScore;
}
function toCountItem(label, m) {
    const lane = m.freqRank && m.bm25Rank ? "both" : m.bm25Rank ? "bm25" : m.freqRank ? "freq" : undefined;
    return {
        label,
        count: Math.max(m.messageHits, 1),
        distinctiveRank: m.bm25Rank,
        keywordLane: lane,
    };
}
/**
 * 빈도 레인(메시지 df) + BM25 레인(특이어) 합집합.
 * distinctive = 합성점수 순, byFrequency = 메시지 수 순.
 */
export function mergeDualLaneKeywords(candidates, supplement, messageCount, outputLimit, semanticSupplementWeight = 0.85) {
    const filtered = candidates.filter((item) => !isNoiseKeyword(item.label));
    if (filtered.length === 0)
        return { distinctive: [], byFrequency: [] };
    const { freqCap, bm25Cap } = keywordLaneCaps(messageCount, outputLimit);
    const byHits = [...filtered].sort((a, b) => b.messageHits - a.messageHits ||
        b.score - a.score ||
        b.label.length - a.label.length ||
        a.label.localeCompare(b.label));
    const byScore = [...filtered].sort((a, b) => b.score - a.score ||
        b.messageHits - a.messageHits ||
        b.label.length - a.label.length ||
        a.label.localeCompare(b.label));
    const freqLane = byHits.slice(0, freqCap);
    const bm25Lane = byScore.slice(0, bm25Cap);
    const maxHits = Math.max(1, freqLane[0]?.messageHits ?? 1);
    const maxScore = Math.max(1e-9, bm25Lane[0]?.score ?? 1e-9);
    const meta = new Map();
    const dfFloor = Math.max(4, Math.sqrt(Math.max(messageCount, 1)));
    const upsert = (item, laneRrf) => {
        const prev = meta.get(item.label);
        const nh = normLogHits(item.messageHits, maxHits);
        const ns = normScore(item.score, maxScore);
        const distinctive = Math.min(1, item.messageHits / dfFloor);
        const composite = FREQ_WEIGHT * nh + BM25_WEIGHT * ns * distinctive;
        if (!prev) {
            meta.set(item.label, {
                messageHits: item.messageHits,
                score: item.score,
                composite,
                rrf: laneRrf,
            });
            return;
        }
        prev.rrf += laneRrf;
        prev.composite = Math.max(prev.composite, composite);
        prev.messageHits = Math.max(prev.messageHits, item.messageHits);
        prev.score = Math.max(prev.score, item.score);
    };
    freqLane.forEach((item, i) => {
        upsert(item, rrf(i + 1));
        const row = meta.get(item.label);
        if (row)
            row.freqRank = i + 1;
    });
    bm25Lane.forEach((item, i) => {
        upsert(item, rrf(i + 1) * 0.92);
        const row = meta.get(item.label);
        if (row)
            row.bm25Rank = i + 1;
    });
    const hitsByLabel = new Map(filtered.map((item) => [item.label, item.messageHits]));
    const suppTop = supplement
        .topCounts(Math.max(8, Math.floor(outputLimit / 5)))
        .filter((x) => !isNoiseKeyword(x.label));
    suppTop.forEach((item, i) => {
        const corpusHits = hitsByLabel.get(item.label);
        if (corpusHits === undefined)
            return;
        const prev = meta.get(item.label);
        if (prev)
            prev.rrf += rrf(i + 1) * semanticSupplementWeight;
        else {
            meta.set(item.label, {
                messageHits: corpusHits,
                score: 0,
                composite: normLogHits(corpusHits, maxHits) * FREQ_WEIGHT,
                rrf: rrf(i + 1) * semanticSupplementWeight,
            });
        }
    });
    const entries = [...meta.entries()];
    const distinctive = entries
        .sort((a, b) => b[1].composite - a[1].composite ||
        b[1].messageHits - a[1].messageHits ||
        b[1].rrf - a[1].rrf ||
        b[0].length - a[0].length ||
        a[0].localeCompare(b[0]))
        .slice(0, outputLimit)
        .map(([label, m]) => toCountItem(label, m));
    const byFrequency = entries
        .sort((a, b) => b[1].messageHits - a[1].messageHits ||
        b[1].composite - a[1].composite ||
        b[0].localeCompare(b[0]))
        .slice(0, outputLimit)
        .map(([label, m]) => toCountItem(label, m));
    return { distinctive, byFrequency };
}
//# sourceMappingURL=keyword-rank-dual.js.map