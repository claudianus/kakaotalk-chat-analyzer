export function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
export function formatNumber(value) {
    return new Intl.NumberFormat("ko-KR").format(value);
}
/** 카드·헤드라인용 축약 (만·억, k/M 미사용) */
export function formatCompactNumber(value) {
    if (!Number.isFinite(value) || value < 0)
        return "0";
    const n = Math.round(value);
    if (n >= 100_000_000) {
        const v = n / 100_000_000;
        return v >= 10 ? `${Math.round(v)}억` : `${trimCompactDecimal(v)}억`;
    }
    if (n >= 10_000) {
        const v = n / 10_000;
        return v >= 100 ? `${Math.round(v)}만` : `${trimCompactDecimal(v)}만`;
    }
    return formatNumber(n);
}
function trimCompactDecimal(value) {
    return value.toFixed(1).replace(/\.0$/, "");
}
export function renderHighlightLine(line) {
    const parts = line.split("**");
    return parts.map((part, i) => (i % 2 === 1 ? `<strong>${escapeHtml(part)}</strong>` : escapeHtml(part))).join("");
}
//# sourceMappingURL=report-util.js.map