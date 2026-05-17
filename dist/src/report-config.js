/** 리포트 UI·집계 상한 — env 오버라이드 */
export function keywordSummaryTop() {
    const n = Number(process.env.KCA_KEYWORD_SUMMARY_TOP);
    if (Number.isFinite(n) && n > 0)
        return Math.min(Math.floor(n), 48);
    return 12;
}
export function shopSearchDisplayTop() {
    const n = Number(process.env.KCA_SHOP_SEARCH_TOP);
    if (Number.isFinite(n) && n > 0)
        return Math.min(Math.floor(n), 100);
    return 30;
}
export function topicDisplayMax() {
    const n = Number(process.env.KCA_TOPIC_MAX);
    if (Number.isFinite(n) && n > 0)
        return Math.min(Math.floor(n), 16);
    return 12;
}
export function topicMinThemesLargeCorpus() {
    const n = Number(process.env.KCA_TOPIC_MIN_THEMES);
    if (Number.isFinite(n) && n > 0)
        return Math.min(Math.floor(n), 12);
    return 4;
}
export function embeddingThemeMax() {
    const n = Number(process.env.KCA_EMBEDDING_TOPIC_MAX);
    if (Number.isFinite(n) && n > 0)
        return Math.min(Math.floor(n), 12);
    return 10;
}
//# sourceMappingURL=report-config.js.map