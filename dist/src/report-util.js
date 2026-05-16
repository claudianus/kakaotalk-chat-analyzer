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
export function renderHighlightLine(line) {
    const parts = line.split("**");
    return parts.map((part, i) => (i % 2 === 1 ? `<strong>${escapeHtml(part)}</strong>` : escapeHtml(part))).join("");
}
//# sourceMappingURL=report-util.js.map