import { escapeHtml } from "./report-util.js";
export function renderPeriodMetricsComparison(data) {
    const rp = data.recentPeriodInsights;
    if (!rp || rp.metrics.length === 0)
        return "";
    const rows = rp.metrics
        .map((m) => `<tr><td>${escapeHtml(m.label)}</td><td class="num">${escapeHtml(m.whole)}</td><td class="num period-metrics-week">${escapeHtml(m.week)}</td></tr>`)
        .join("");
    return `<div class="period-metrics-block" data-observe>
    <h3 class="period-metrics-title">전체 vs 최근 7일</h3>
    <p class="chart-hint">같은 지표를 <strong>전 기간</strong>과 <strong>최근 7일</strong>로 나란히 봅니다.</p>
    <div class="glass-table-wrap">
      <table class="table table-glass period-metrics-table">
        <thead><tr><th>지표</th><th class="num">전체</th><th class="num">최근 7일</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}
export function renderWeekTopSendersStrip(data) {
    const senders = data.recentPeriodInsights?.weekTopSenders ?? [];
    if (senders.length === 0)
        return "";
    const items = senders
        .map((s, i) => `<li class="week-sender-item" data-observe><span class="week-sender-rank">${i + 1}</span><span class="week-sender-name">${escapeHtml(s.alias)}</span><span class="week-sender-count">${s.count}건 · ${s.sharePercent}%</span></li>`)
        .join("");
    return `<div class="week-senders-strip" data-observe aria-label="최근 7일 참여자 상위">
    <h3 class="insight-sub">최근 7일 말 많은 순</h3>
    <ol class="week-sender-list">${items}</ol>
  </div>`;
}
//# sourceMappingURL=report-period-metrics.js.map