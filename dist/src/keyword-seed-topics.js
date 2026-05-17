import { isGenericTopicLead } from "./topic-generic.js";
import { isNoiseKeyword } from "./keyword-quality.js";
function topicPercent(messageHits, totalMessages) {
    return Math.round(Math.min(100, (messageHits / Math.max(totalMessages, 1)) * 100) * 10) / 10;
}
function expandLabelTerms(label) {
    return label
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2 && !isNoiseKeyword(t));
}
function buildTitle(label, terms) {
    const parts = expandLabelTerms(label);
    if (parts.length >= 2)
        return parts.slice(0, 2).join(" · ");
    const sub = terms.find((t) => t !== parts[0] && !isGenericTopicLead(t));
    const lead = parts[0] ?? label;
    return sub && sub !== lead ? `${lead} · ${sub}` : lead;
}
/** 키워드 상위(빈도·특이어) → 미니 테마 카드 */
export function buildKeywordSeedTopics(keywordsByFreq, keywordsDistinctive, totalMessages, topicMap) {
    if (totalMessages < 30)
        return [];
    const seen = new Set();
    const seeds = [];
    for (const k of keywordsByFreq.slice(0, 12)) {
        if (seen.has(k.label))
            continue;
        seen.add(k.label);
        seeds.push({ label: k.label, count: k.count, distinctive: false });
    }
    for (const k of keywordsDistinctive.slice(0, 8)) {
        if (seen.has(k.label))
            continue;
        seen.add(k.label);
        seeds.push({ label: k.label, count: k.count, distinctive: true });
    }
    const topics = [];
    for (const seed of seeds) {
        if (isGenericTopicLead(seed.label) && !seed.distinctive)
            continue;
        const baseTerms = expandLabelTerms(seed.label);
        if (baseTerms.length === 0)
            continue;
        const neighbors = topicMap?.getCooccurrenceNeighbors(seed.label, 3) ?? [];
        const terms = [...new Set([...baseTerms, ...neighbors])].slice(0, 8);
        if (terms.length < 1)
            continue;
        const pct = topicPercent(seed.count, totalMessages);
        if (pct < 0.5)
            continue;
        topics.push({
            id: `kw-${topics.length}`,
            kind: "theme",
            title: buildTitle(seed.label, terms),
            terms,
            messagePercent: pct,
        });
    }
    return topics.sort((a, b) => b.messagePercent - a.messagePercent);
}
//# sourceMappingURL=keyword-seed-topics.js.map