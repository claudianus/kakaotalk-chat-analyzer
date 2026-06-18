const CLOUD_BOILERPLATE_RE = /^(?:사이트|요약|short|oursophy|short oursophy|사이트 요약|요약입니다)(?:\s|$)/i;
/** 워드클라우드용 — 샵검색·요약 boilerplate·초단어 노이즈 제거 */
export function keywordsForCloud(keywords, limit = 100) {
    const filtered = keywords.filter((k) => {
        const label = k.label.trim();
        if (label.length < 2)
            return false;
        if (CLOUD_BOILERPLATE_RE.test(label))
            return false;
        if (/^요약/.test(label) && label.length <= 8)
            return false;
        return true;
    });
    const pool = filtered.length > 0 ? filtered : keywords;
    const scored = [...pool].sort((a, b) => {
        const laneBoost = (k) => k.keywordLane === "bm25" ? 3 : k.keywordLane === "both" ? 2 : k.keywordLane === "freq" ? 0 : 1;
        return laneBoost(b) - laneBoost(a) || b.count - a.count;
    });
    return scored.slice(0, limit).map((k) => ({ label: k.label, count: k.count }));
}
/** 활동일 < 90일·활동 월 ≤ 2 — 월별 period 카드/차트는 기간 비교로 안내 */
export function isShortActivitySpan(daily) {
    const active = daily.filter((d) => d.count > 0);
    if (active.length === 0 || active.length >= 90)
        return false;
    const months = new Set(active.map((d) => d.date.slice(0, 7)));
    return months.size <= 2;
}
export function topicsForDisplay(topics, daily) {
    const normalized = normalizeTopicPercents(topics);
    if (!isShortActivitySpan(daily))
        return normalized;
    return normalized.filter((t) => t.kind === "theme");
}
export function topicsThemesOnly(topics) {
    return normalizeTopicPercents(topics).filter((t) => t.kind === "theme");
}
export function chooseTopicTrendGranularity(args) {
    if (args.spanDays <= 31 || args.activeDays <= 14)
        return "daily";
    if (args.spanDays <= 180)
        return "weekly";
    return "monthly";
}
function normalizeTopicPercents(topics) {
    return topics.map((t) => ({
        ...t,
        messagePercent: clampPercent(t.messagePercent),
    }));
}
function clampPercent(value) {
    if (!Number.isFinite(value))
        return 0;
    return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}
//# sourceMappingURL=report-chart-util.js.map