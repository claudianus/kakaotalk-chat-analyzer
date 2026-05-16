function pad2(n) {
    return String(n).padStart(2, "0");
}
/** YYYY-MM-DD — since 이상만 통과 */
export function recordOnOrAfter(record, sinceYmd) {
    const d = `${record.date.year}-${pad2(record.date.month)}-${pad2(record.date.day)}`;
    return d >= sinceYmd;
}
export function parseSinceOption(since) {
    if (!since)
        return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) {
        throw new Error(`--since must be YYYY-MM-DD, got: ${since}`);
    }
    return since;
}
//# sourceMappingURL=report-date-filter.js.map