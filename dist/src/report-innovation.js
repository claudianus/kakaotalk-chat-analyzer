import { timelineActivityRange } from "./event-spine.js";
import { escapeHtml, formatNumber, renderHighlightLine } from "./report-util.js";
export function renderInnovationDeck(data) {
    return [
        renderNarrativeBlock(data),
        renderTimelineBlock(data),
        renderDyadBlock(data),
        renderPeriodCompareBlock(data),
        renderBenchmarkBlock(data),
        renderExplorerBlock(data),
    ].join("\n");
}
function renderNarrativeBlock(data) {
    const n = data.narrative;
    if (!n.paragraphs.length && !data.llmInsights)
        return "";
    const paras = n.paragraphs.map((p) => `<p class="narrative-p">${renderHighlightLine(p)}</p>`).join("");
    const llm = renderLlmInsightsBlock(data);
    const hint = data.summary.usedLlmAnalysis
        ? "통계·키워드만 입력한 <strong>로컬 LLM</strong>이 서사·인사이트를 보강했습니다(원문 미포함)."
        : "규칙·통계만으로 만든 <strong>재현 가능</strong>한 요약이에요.";
    return `<section id="s-narrative" class="card narrative-card anim-enter" style="margin-bottom:14px;--enter-delay:0.04s" aria-label="방 프로필 서사">
    <h2 class="section-glow">② 방 프로필 (자동 서사)</h2>
    <p class="chart-hint">${hint}</p>
    <div class="narrative-body">${paras}${llm}</div>
  </section>`;
}
function renderLlmInsightsBlock(data) {
    const ins = data.llmInsights;
    if (!ins)
        return "";
    const bullets = (ins.insightBullets ?? [])
        .map((b) => `<li>${renderHighlightLine(b)}</li>`)
        .join("");
    const proposals = (ins.topicProposals ?? [])
        .map((p) => `<li><strong>${escapeHtml(p.title)}</strong> — ${p.terms.map((t) => escapeHtml(t)).join(", ")}</li>`)
        .join("");
    const extra = [
        ins.shopSearchSummary ? `<p class="llm-extra"><strong>샵검색</strong> ${renderHighlightLine(ins.shopSearchSummary)}</p>` : "",
        ins.dyadInsight ? `<p class="llm-extra"><strong>상호작용</strong> ${renderHighlightLine(ins.dyadInsight)}</p>` : "",
        proposals
            ? `<div class="llm-topic-proposals"><h3 class="insight-sub">LLM 주제 제안</h3><ul class="llm-bullets">${proposals}</ul></div>`
            : "",
    ].join("");
    if (!bullets && !extra)
        return "";
    return `<div class="llm-insights" style="margin-top:12px">
    ${bullets ? `<h3 class="insight-sub">LLM 인사이트</h3><ul class="llm-bullets">${bullets}</ul>` : ""}
    ${extra}
  </div>`;
}
function renderTimelineBlock(data) {
    if (data.timeline.length === 0)
        return "";
    const items = data.timeline
        .map((e) => {
        const jump = e.jumpId
            ? ` <a href="#${escapeHtml(e.jumpId)}" data-kca-jump="${escapeHtml(e.jumpId)}">보기</a>`
            : "";
        return `<li class="spine-item spine-${escapeHtml(e.kind)}">
        <time datetime="${escapeHtml(e.date)}">${escapeHtml(e.date)}</time>
        <strong>${escapeHtml(e.title)}</strong>
        <span>${escapeHtml(e.detail)}${jump}</span>
      </li>`;
    })
        .join("");
    const range = timelineActivityRange(data.daily);
    const rangeLine = range
        ? `활동 <strong>${escapeHtml(range.first)}</strong>~<strong>${escapeHtml(range.last)}</strong> · 이벤트 <strong>${data.timeline.length}</strong>건 — `
        : "";
    return `<section id="s-timeline" class="card spine-card anim-enter" style="margin-bottom:14px;--enter-delay:0.045s" aria-label="이벤트 타임라인">
    <h2 class="section-glow">이벤트 스파인</h2>
    <p class="chart-hint">${rangeLine}급증·침묵·입퇴장·링크·약속 신호 등 <strong>임계값을 넘은 날</strong>만 나열합니다(전 기간 달력 아님).</p>
    <ol class="spine-list">${items}</ol>
  </section>`;
}
function renderDyadBlock(data) {
    const m = data.interaction;
    if (!m || m.totalReplies < 3)
        return "";
    const pairs = m.topPairs
        .slice(0, 6)
        .map((p) => `<li><strong>${escapeHtml(p.fromAlias)}</strong> → ${escapeHtml(p.toAlias)} · <span class="num">${formatNumber(p.replies)}</span>회</li>`)
        .join("");
    return `<section id="s-dyad" class="card anim-enter" style="margin-bottom:14px;--enter-delay:0.048s" aria-label="상호작용">
    <h2 class="section-glow">누가 누구에게 답하는가</h2>
    <p class="chart-hint">연속 메시지에서 화자가 바뀔 때 <strong>직전 화자 → 현재 화자</strong>로 응답 엣지를 셉니다(상위 ${m.aliases.length}명).</p>
    <ul class="dyad-pairs">${pairs}</ul>
    <div id="chart-dyad" class="chart-box chart-box--dyad is-loading" aria-busy="true" aria-label="상호작용 히트맵">
      <div class="chart-skeleton chart-skeleton--heatmap" aria-hidden="true"></div>
    </div>
  </section>`;
}
function renderPeriodCompareBlock(data) {
    const pc = data.periodCompare;
    const slices = pc.slices
        .map((s) => `<div class="period-slice"><b>${escapeHtml(s.label)}</b><span class="num">${formatNumber(s.messages)}</span>건 · 활동 ${formatNumber(s.activeDays)}일 · 일당 ${s.messagesPerActiveDay}</div>`)
        .join("");
    const shift = pc.keywordShift.onlyHead.length || pc.keywordShift.onlyTail.length
        ? `<div class="kw-shift">
      <div><h4>초반에만 두드러짐</h4><p>${pc.keywordShift.onlyHead.map((k) => escapeHtml(k)).join(" · ") || "—"}</p></div>
      <div><h4>후반에만 두드러짐</h4><p>${pc.keywordShift.onlyTail.map((k) => escapeHtml(k)).join(" · ") || "—"}</p></div>
    </div>`
        : "";
    return `<section id="s-compare" class="card anim-enter" style="margin-bottom:14px;--enter-delay:0.05s" aria-label="기간 비교">
    <h2 class="section-glow">기간 비교</h2>
    <p class="chart-hint">처음 7일·마지막 7일·전체와, 월별 키워드 <strong>전반/후반</strong> 차이입니다.</p>
    <div class="period-grid">${slices}</div>
    ${shift}
  </section>`;
}
function renderBenchmarkBlock(data) {
    if (data.benchmarks.length === 0)
        return "";
    const rows = data.benchmarks
        .map((b) => `<tr><td>${escapeHtml(b.label)}</td><td class="num">${b.value}</td><td class="num">${b.percentile}%</td><td><span class="bench-band">${escapeHtml(b.band)}</span></td></tr>`)
        .join("");
    return `<section id="s-bench" class="card bench-card anim-enter" style="margin-bottom:14px;--enter-delay:0.052s" aria-label="참고 벤치마크">
    <h2>참고 밴드 <span class="bench-estimate-tag">추정·표본 기반</span></h2>
    <p class="chart-hint bench-disclaimer">합성·공개 fixture만으로 만든 <strong>상대 분위 추정</strong>입니다. 실제 업로드 방과 직접 비교·순위 확정 용도로 쓰지 마세요.</p>
    <table class="bench-table"><thead><tr><th>지표</th><th>값</th><th>분위</th><th>밴드</th></tr></thead><tbody>${rows}</tbody></table>
  </section>`;
}
function renderExplorerBlock(data) {
    if (data.explorer.daily.length < 3)
        return "";
    return `<section id="s-explorer" class="card explorer-card anim-enter" style="margin-bottom:14px;--enter-delay:0.055s" aria-label="기간 탐색">
    <h2 class="section-glow">기간 탐색</h2>
    <p class="chart-hint">날짜를 좁히면 아래 숫자가 <strong>선택 기간만</strong> 다시 집계됩니다(브라우저 내, 원문 없음).</p>
    <div class="explorer-controls">
      <label>시작 <input type="date" id="kca-range-from" min="${escapeHtml(data.explorer.range.min)}" max="${escapeHtml(data.explorer.range.max)}" value="${escapeHtml(data.explorer.range.min)}"></label>
      <label>끝 <input type="date" id="kca-range-to" min="${escapeHtml(data.explorer.range.min)}" max="${escapeHtml(data.explorer.range.max)}" value="${escapeHtml(data.explorer.range.max)}"></label>
    </div>
    <div class="explorer-stats" id="kca-explorer-stats" aria-live="polite"></div>
    <div id="chart-explorer-daily" class="chart-box compact" role="img" aria-label="선택 기간 일별"></div>
  </section>`;
}
//# sourceMappingURL=report-innovation.js.map