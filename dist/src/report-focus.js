import { escapeHtml, formatNumber } from "./report-util.js";
function sumHourly(hourly) {
    return hourly.reduce((a, b) => a + b, 0);
}
function focusDayStats(day) {
    if (!day || day.messageCount === 0) {
        return { messages: 0, participants: 0, lead: "—", keywords: "—" };
    }
    const lead = day.topSenders[0];
    return {
        messages: day.messageCount,
        participants: day.activeParticipants,
        lead: lead ? `${lead.alias}(${lead.count})` : "—",
        keywords: day.keywords.slice(0, 3).join(" · ") || "—",
    };
}
function renderFocusColumn(title, badge, stats, extra) {
    return `<article class="focus-col" data-observe>
    <header class="focus-col-head"><span class="focus-badge">${escapeHtml(badge)}</span><h3>${escapeHtml(title)}</h3></header>
    <dl class="focus-stats">
      <div><dt>메시지</dt><dd>${formatNumber(stats.messages)}건</dd></div>
      <div><dt>참여</dt><dd>${formatNumber(stats.participants)}명</dd></div>
      <div><dt>주도</dt><dd>${escapeHtml(stats.lead)}</dd></div>
      <div><dt>키워드</dt><dd>${escapeHtml(stats.keywords)}</dd></div>
    </dl>
    ${extra ? `<p class="focus-extra">${extra}</p>` : ""}
  </article>`;
}
export function renderRecentFocusDeck(data) {
    const snap = data.recentSnapshot;
    if (!snap)
        return "";
    const today = focusDayStats(snap.today);
    const week = snap;
    const weekStats = {
        messages: week.weekTotal,
        participants: week.weekParticipants,
        lead: week.week
            .flatMap((d) => d.topSenders)
            .sort((a, b) => b.count - a.count)[0],
        keywords: week.weekKeywords.slice(0, 3).join(" · ") || "—",
    };
    const weekFocus = {
        messages: weekStats.messages,
        participants: weekStats.participants,
        lead: weekStats.lead ? `${weekStats.lead.alias}(${weekStats.lead.count})` : "—",
        keywords: weekStats.keywords,
    };
    const todayHourly = snap.today?.hourly ?? [];
    const todayHourSum = sumHourly(todayHourly);
    const todayPeak = snap.today?.peakHour !== null && snap.today?.peakHour !== undefined
        ? `가장 붐빈 시간 ${snap.today.peakHour}시`
        : "";
    const weekExtra = `일평균 ${formatNumber(Math.round(week.weekTotal / 7))}건 · 전체 대비 ${week.weekVsOverall}배`;
    return `<section id="s-recent-focus" class="kca-section card kca-card--focus recent-focus-deck anim-enter" data-observe style="--enter-delay:0.02s" aria-label="최근 집중 분석">
    <h2 class="zone-title">🔥 지금 이 방</h2>
    <p class="chart-hint">멀리 간 과거보다 <strong>최근 24시간·7일</strong>을 먼저 봅니다.</p>
    <div class="focus-cols">
      ${renderFocusColumn("최근 24시간", "24h", today, todayPeak ? escapeHtml(todayPeak) : undefined)}
      ${renderFocusColumn("최근 7일", "7d", weekFocus, escapeHtml(weekExtra))}
    </div>
  </section>`;
}
//# sourceMappingURL=report-focus.js.map