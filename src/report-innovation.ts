import { timelineActivityRange } from "./event-spine.js";
import type { ReportData } from "./types.js";
import { escapeHtml, formatNumber } from "./report-util.js";
import {
  hasActivityRestRhythm,
  hasBenchmarkSection,
  hasBurstAnatomy,
  hasDaypartFingerprint,
  hasKeywordGravity,
  hasParticipantDynamics,
  hasQuestionAnswerTopology,
  hasReplyLatencyFingerprint,
  hasRhythmSilenceMap,
  hasSentimentRollercoaster,
  hasTopicFlow,
} from "./report-section-visibility.js";
import {
  renderLlmDayMicroStories,
  renderLlmEraLabels,
  renderLlmRelationshipBeats,
  renderMemorableMomentsList,
} from "./report-llm-deck.js";

export function renderStoryTimelinePair(data: ReportData): string {
  const momentsList = renderMemorableMomentsList(data);
  const spineList = renderTimelineList(data);
  if (!momentsList && !spineList) return "";

  const momentsCol = momentsList
    ? `<div class="story-timeline-pair__col story-timeline-pair__col--moments">
      <h2 class="llm-strip-title">✨ 기억에 남는 순간</h2>
      <p class="chart-hint">활동 급증·감정 반전·마일스톤 등 규칙으로 뽑은 하이라이트입니다.</p>
      ${momentsList}
    </div>`
    : "";
  const spineCol = spineList
    ? `<div class="story-timeline-pair__col story-timeline-pair__col--spine">
      <h2 class="llm-strip-title">⏳ 이벤트 스파인</h2>
      ${renderTimelineHint(data)}
      ${spineList}
    </div>`
    : "";

  return `<section id="s-story-pair" class="kca-section story-timeline-pair anim-enter" data-observe style="--enter-delay:0.04s" aria-label="기억에 남는 순간과 이벤트 스파인">
    <div class="story-timeline-pair__grid">${momentsCol}${spineCol}</div>
  </section>`;
}

export function renderInnovationDeck(data: ReportData): string {
  return [
    renderDyadBlock(data),
    renderPeriodCompareBlock(data),
    hasBenchmarkSection(data) ? renderBenchmarkBlock(data) : "",
    renderExplorerBlock(data),
    hasSentimentRollercoaster(data) ? renderSentimentRollercoaster(data) : "",
    hasRhythmSilenceMap(data) ? renderRhythmSilenceMap(data) : "",
    hasActivityRestRhythm(data) ? renderActivityRestRhythm(data) : "",
    hasParticipantDynamics(data) ? renderParticipantDynamics(data) : "",
    hasDaypartFingerprint(data) ? renderDaypartFingerprint(data) : "",
    hasTopicFlow(data) ? renderTopicFlow(data) : "",
    hasReplyLatencyFingerprint(data) ? renderReplyLatencyFingerprint(data) : "",
    hasQuestionAnswerTopology(data) ? renderQuestionAnswerTopology(data) : "",
    hasBurstAnatomy(data) ? renderBurstAnatomy(data) : "",
    hasKeywordGravity(data) ? renderKeywordGravity(data) : "",
  ].join("\n");
}

function renderTimelineHint(data: ReportData): string {
  const range = timelineActivityRange(data.daily);
  const rangeLine = range
    ? `활동 <strong>${escapeHtml(range.first)}</strong>~<strong>${escapeHtml(range.last)}</strong> · 이벤트 <strong>${data.timeline.length}</strong>건 — `
    : "";
  return `<p class="chart-hint">${rangeLine}급증·침묵·입퇴장·링크·약속 신호 등 <strong>임계값을 넘은 날</strong>만 나열합니다.</p>`;
}

function renderTimelineList(data: ReportData): string {
  if (data.timeline.length === 0) return "";
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
  return `<ol id="s-timeline" class="spine-list">${items}</ol>`;
}

function renderDyadBlock(data: ReportData): string {
  const m = data.interaction;
  if (!m || m.totalReplies < 3) return "";
  return `<section id="s-dyad" class="kca-section card kca-card--data anim-enter" data-observe style="--enter-delay:0.048s" aria-label="상호작용">
    <h2 class="section-glow">누가 누구에게 답하는가</h2>
    <p class="chart-hint">연속 메시지에서 화자가 바뀔 때 <strong>직전 화자 → 현재 화자</strong>로 응답 엣지를 셉니다(상위 ${m.aliases.length}명).</p>
    ${renderLlmRelationshipBeats(data)}
    ${renderChemistryCards(m)}
    <div id="chart-dyad" class="chart-box chart-box--dyad is-loading" aria-busy="true" aria-label="상호작용 히트맵">
      <div class="chart-skeleton chart-skeleton--heatmap" aria-hidden="true"></div>
    </div>
  </section>`;
}

export function renderChemistryCards(m: NonNullable<ReportData["interaction"]>): string {
  const pairMap = new Map<string, { a: string; b: string; aToB: number; bToA: number }>();
  for (const p of m.topPairs) {
    const a = p.fromAlias;
    const b = p.toAlias;
    if (a === b) continue;
    const key = [a, b].sort().join("\u0001");
    const entry = pairMap.get(key) ?? { a, b, aToB: 0, bToA: 0 };
    const i = m.aliases.indexOf(a);
    const j = m.aliases.indexOf(b);
    const directed = i >= 0 && j >= 0 ? (m.matrix[i]?.[j] ?? 0) : p.replies;
    if (a === entry.a) entry.aToB += directed;
    else entry.bToA += directed;
    pairMap.set(key, entry);
  }

  const cards = Array.from(pairMap.values())
    .map((p) => ({ ...p, total: p.aToB + p.bToA }))
    .sort((x, y) => y.total - x.total)
    .slice(0, 3)
    .map((p) => {
      const total = p.total;
      let initiator = "양쪽";
      if (p.aToB > p.bToA) initiator = p.a;
      else if (p.bToA > p.aToB) initiator = p.b;
      const balance = total > 0 ? Math.min(p.aToB, p.bToA) / total : 0;
      const balancePct = Math.round(balance * 100);
      return `<article class="chemistry-card" data-observe role="listitem">
        <div class="chemistry-pair">${escapeHtml(p.a)} ↔ ${escapeHtml(p.b)}</div>
        <div class="chemistry-line"><span>주도</span><strong>${escapeHtml(initiator)}</strong></div>
        <div class="chemistry-line"><span>밸런스</span><strong>${balancePct}%</strong></div>
        <div class="chemistry-line"><span>합계 응답</span><strong>${formatNumber(total)}회</strong></div>
      </article>`;
    })
    .join("");
  return `<div class="chemistry-cards" role="list">${cards}</div>`;
}

function renderPeriodCompareBlock(data: ReportData): string {
  const pc = data.periodCompare;
  const slices = pc.slices
    .map(
      (s) =>
        `<div class="period-slice"><b>${escapeHtml(s.label)}</b><span class="num">${formatNumber(s.messages)}</span>건 · 활동 ${formatNumber(s.activeDays)}일 · 일당 ${s.messagesPerActiveDay}</div>`,
    )
    .join("");
  const shift =
    pc.keywordShift.onlyHead.length || pc.keywordShift.onlyTail.length
      ? `<div class="kw-shift">
      <div><h4>초반에만 두드러짐</h4><p>${pc.keywordShift.onlyHead.map((k) => escapeHtml(k)).join(" · ") || "—"}</p></div>
      <div><h4>후반에만 두드러짐</h4><p>${pc.keywordShift.onlyTail.map((k) => escapeHtml(k)).join(" · ") || "—"}</p></div>
    </div>`
      : "";
  return `<section id="s-compare" class="kca-section card kca-card--data anim-enter" data-observe style="--enter-delay:0.05s" aria-label="기간 비교">
    <h2 class="section-glow">기간 비교</h2>
    <p class="chart-hint">처음 7일·마지막 7일·전체와, 대화 기간의 <strong>전반/후반</strong> 키워드 차이입니다.</p>
    ${renderLlmEraLabels(data)}
    <div class="period-grid">${slices}</div>
    ${shift}
  </section>`;
}

function renderBenchmarkBlock(data: ReportData): string {
  if (data.benchmarks.length === 0) return "";
  const rows = data.benchmarks
    .map(
      (b) =>
        `<tr><td>${escapeHtml(b.label)}</td><td class="num">${b.value}</td><td class="num">${b.percentile}%</td><td><span class="bench-band">${escapeHtml(b.band)}</span></td></tr>`,
    )
    .join("");
  return `<section id="s-bench" class="kca-section card kca-card--data bench-card anim-enter" data-observe style="--enter-delay:0.052s" aria-label="참고 벤치마크">
    <h2>참고 밴드 <span class="bench-estimate-tag">추정·표본 기반</span></h2>
    <p class="chart-hint bench-disclaimer">합성·공개 fixture만으로 만든 <strong>상대 분위 추정</strong>입니다. 실제 업로드 방과 직접 비교·순위 확정 용도로 쓰지 마세요.</p>
    <table class="bench-table"><thead><tr><th>지표</th><th>값</th><th>분위</th><th>밴드</th></tr></thead><tbody>${rows}</tbody></table>
  </section>`;
}

function renderExplorerBlock(data: ReportData): string {
  if (data.explorer.daily.length < 3) return "";
  return `<section id="s-explorer" class="kca-section card kca-card--data explorer-card anim-enter" data-observe style="--enter-delay:0.055s" aria-label="기간 탐색">
    <h2 class="section-glow">기간 탐색</h2>
    <p class="chart-hint">날짜를 좁히면 아래 숫자가 <strong>선택 기간만</strong> 다시 집계됩니다(브라우저 내, 원문 없음).</p>
    <div class="explorer-controls">
      <label>시작 <input type="date" id="kca-range-from" min="${escapeHtml(data.explorer.range.min)}" max="${escapeHtml(data.explorer.range.max)}" value="${escapeHtml(data.explorer.range.min)}"></label>
      <label>끝 <input type="date" id="kca-range-to" min="${escapeHtml(data.explorer.range.min)}" max="${escapeHtml(data.explorer.range.max)}" value="${escapeHtml(data.explorer.range.max)}"></label>
    </div>
    <div class="explorer-stats" id="kca-explorer-stats" aria-live="polite"></div>
    ${renderLlmDayMicroStories(data)}
    <div id="chart-explorer-daily" class="chart-box compact" role="img" aria-label="선택 기간 일별"></div>
  </section>`;
}

function renderSentimentRollercoaster(data: ReportData): string {
  const items = data.dailySentiment;
  const width = 100;
  const height = 48;
  const padding = 4;
  const energies = items.map((d) => d.energy);
  const minEnergy = Math.min(...energies, -15);
  const maxEnergy = Math.max(...energies, 15);
  const span = Math.max(maxEnergy - minEnergy, 20);
  const xStep = items.length > 1 ? (width - padding * 2) / (items.length - 1) : 0;
  const yFor = (energy: number) =>
    height - padding - ((energy - minEnergy) / span) * (height - padding * 2);
  const points = items
    .map((d, i) => {
      const x = padding + i * xStep;
      const y = yFor(d.energy);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const areaPoints = `${padding},${height - padding} ${points} ${padding + (items.length - 1) * xStep},${height - padding}`;
  const dots = items
    .map((d, i) => {
      const x = padding + i * xStep;
      const y = yFor(d.energy);
      const cls = d.energy > 10 ? "pos" : d.energy < -10 ? "neg" : "mid";
      return `<circle class="sentiment-dot sentiment-dot--${cls}" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2.2"><title>${escapeHtml(d.date)}: ${d.energy}</title></circle>`;
    })
    .join("");

  const spikes = items
    .slice(1)
    .map((d, i) => ({
      date: d.date,
      change: Math.abs(d.energy - items[i]!.energy),
      energy: d.energy,
    }))
    .sort((a, b) => b.change - a.change)
    .slice(0, 3);

  const spikeList = spikes
    .map((s) => {
      const direction = s.energy > 0 ? "긍정" : s.energy < 0 ? "부정" : "중립";
      return `<li><time>${escapeHtml(s.date)}</time> <span class="num">${formatNumber(s.change)}%p</span> 변화 · ${direction}</li>`;
    })
    .join("");

  return `<section id="s-sentiment" class="kca-section card kca-card--data anim-enter" data-observe style="--enter-delay:0.056s" aria-label="감정 롤러코스터">
    <h2 class="section-glow">감정 롤러코스터</h2>
    <p class="chart-hint">날마다 긍정·부정 톤이 얼마나 올랐다 내려갔는지 — 점이 높을수록 분위기가 가벼웠던 날입니다.</p>
    <svg class="sentiment-coaster-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="일별 감정 에너지">
      <line x1="${padding}" y1="${yFor(0).toFixed(2)}" x2="${width - padding}" y2="${yFor(0).toFixed(2)}" stroke="var(--line)" stroke-width="0.6" stroke-dasharray="2 2" />
      <polygon points="${areaPoints}" fill="color-mix(in oklab, var(--accent) 22%, transparent)" />
      <polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      ${dots}
    </svg>
    <div class="sentiment-coaster-legend">
      <span>기준선 = 중립</span>
      <span class="sentiment-coaster-dot">● 높음=가벼움</span>
      <span class="sentiment-coaster-dot">● 낮음=무거움</span>
    </div>
    <ol class="sentiment-spike-list">${spikeList}</ol>
  </section>`;
}

function renderRhythmSilenceMap(data: ReportData): string {
  const ins = data.insights;
  const maxSilence = ins.maxSilenceBetweenActiveDays ?? 0;
  const burst = ins.burstGapUnder1mPercent ?? 0;
  const gapOver60 = ins.gapOver60mPercent ?? 0;

  let interpretation = "전반적으로 고른 템포를 유지한 대화입니다.";
  if (burst >= 30 && gapOver60 >= 30) {
    interpretation = "빠른 왕복과 긴 침묵이 교차하는 비동기·버스트 대화 패턴입니다.";
  } else if (burst >= 30) {
    interpretation = "짧은 간격의 연속 대화가 많은 실시간형 리듬입니다.";
  } else if (gapOver60 >= 30) {
    interpretation = "대부분 느긋한 간격으로 이어지는 비동기형 대화입니다.";
  }

  return `<section id="s-rhythm" class="kca-section card kca-card--data anim-enter" data-observe style="--enter-delay:0.057s" aria-label="대화 리듬과 침묵">
    <h2 class="section-glow">대화 리듬 & 침묵 지도</h2>
    <p class="chart-hint">세션과 응답 간격으로 본 대화의 템포와 침묵 패턴입니다.</p>
    <div class="rhythm-metric-grid">
      <div><b>세션 수</b><span class="num">${formatNumber(ins.sessionCount)}</span></div>
      <div><b>세션 길이 중앙값</b><span class="num">${ins.medianSessionMinutes != null ? formatNumber(ins.medianSessionMinutes) + "분" : "—"}</span></div>
      <div><b>최장 침묵</b><span class="num">${maxSilence > 0 ? formatNumber(maxSilence) + "일" : "—"}</span></div>
      <div><b>1분 미만 버스트</b><span class="num">${formatNumber(burst)}%</span></div>
      <div><b>60분 초과 간격</b><span class="num">${formatNumber(gapOver60)}%</span></div>
    </div>
    <div class="silence-bar" role="img" aria-label="빠른 응답과 긴 침묵 비율">
      <span class="silence-seg silence-seg--burst" style="width:${burst.toFixed(2)}%"></span>
      <span class="silence-seg silence-seg--gap" style="width:${gapOver60.toFixed(2)}%"></span>
    </div>
    <p class="rhythm-readout">${escapeHtml(interpretation)}</p>
  </section>`;
}

function renderParticipantDynamics(data: ReportData): string {
  const ins = data.insights;
  const weekSenders = data.recentPeriodInsights?.weekTopSenders ?? [];
  const weekTotal = data.recentSnapshot?.weekTotal ?? 0;
  const useWeek = weekSenders.length >= 3 && weekTotal > 0;
  const bars = useWeek
    ? weekSenders
        .map((p) => {
          const width = weekTotal > 0 ? (p.count / weekTotal) * 100 : 0;
          return `<div class="dynamics-bar" title="${escapeHtml(p.alias)} ${formatNumber(p.count)}건">
        <span class="dynamics-label">${escapeHtml(p.alias)}</span>
        <span class="dynamics-track"><span class="dynamics-fill" style="width:${width.toFixed(2)}%"></span></span>
        <span class="dynamics-num">${formatNumber(p.sharePercent)}%</span>
      </div>`;
        })
        .join("")
    : data.participants
        .slice(0, 10)
        .map((p) => {
          const total = data.summary.totalMessages;
          const width = total > 0 ? (p.messages / total) * 100 : 0;
          return `<div class="dynamics-bar" title="${escapeHtml(p.alias)} ${formatNumber(p.messages)}건">
        <span class="dynamics-label">${escapeHtml(p.alias)}</span>
        <span class="dynamics-track"><span class="dynamics-fill" style="width:${width.toFixed(2)}%"></span></span>
        <span class="dynamics-num">${formatNumber(p.sharePercent)}%</span>
      </div>`;
        })
        .join("");

  const weekTop3 = data.recentPeriodInsights?.metrics.find((m) => m.key === "top3")?.week ?? null;
  const weekGini = data.recentPeriodInsights?.metrics.find((m) => m.key === "gini")?.week ?? null;

  return `<section id="s-dynamics" class="kca-section card kca-card--data anim-enter" data-observe style="--enter-delay:0.058s" aria-label="누가 얼마나 말하나">
    <h2 class="section-glow">누가 얼마나 말하나</h2>
    <p class="chart-hint">${useWeek ? "최근 7일" : "전체"} 기준 메시지 상위 10명 — 막대가 길수록 더 많이 말했습니다.</p>
    <div class="dynamics-curve">${bars}</div>
    <div class="dynamics-metric-grid">
      <div><b>지니 계수</b><span class="num">${ins.participantGini != null ? ins.participantGini.toFixed(2) : "—"}${weekGini && weekGini !== "—" ? ` · 7d ${weekGini}` : ""}</span></div>
      <div><b>상위 3인 점유</b><span class="num">${formatNumber(ins.top3ParticipantSharePercent)}%${weekTop3 ? ` · 7d ${weekTop3}` : ""}</span></div>
      <div><b>독백 메시지</b><span class="num">${formatNumber(ins.monologueMessagesPercent)}%</span></div>
    </div>
  </section>`;
}

function renderDaypartFingerprint(data: ReportData): string {
  const hourly = data.hourly;
  const maxCount = Math.max(...hourly, 1);
  const width = 288;
  const height = 64;
  const barWidth = width / hourly.length;

  const bars = hourly
    .map((c, h) => {
      const barHeight = (c / maxCount) * height;
      const x = h * barWidth;
      const y = height - barHeight;
      const isPeak = h === data.summary.peakHour;
      return `<rect class="daypart-bar ${isPeak ? "daypart-peak" : ""}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(barWidth - 1).toFixed(1)}" height="${barHeight.toFixed(1)}" rx="1" />`;
    })
    .join("");

  const peakHour = data.summary.peakHour;

  return `<section id="s-daypart" class="kca-section card kca-card--data anim-enter" data-observe style="--enter-delay:0.059s" aria-label="시간대 지문">
    <h2 class="section-glow">시간대 지문</h2>
    <p class="chart-hint">24시간 메시지 분포와 심야 비중입니다.</p>
    <div class="daypart-fingerprint">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="시간대별 메시지 분포">
        ${bars}
      </svg>
      <div class="daypart-labels"><span>0</span><span>6</span><span>12</span><span>18</span><span>23</span></div>
    </div>
    <div class="daypart-peak-summary">
      <div><b>피크 시간</b><span class="num">${peakHour != null ? formatNumber(peakHour) + "시" : "—"}</span></div>
      <div><b>심야(23~05) 비중</b><span class="num">${formatNumber(data.summary.nightSharePercent)}%</span></div>
    </div>
  </section>`;
}

function renderTopicFlow(data: ReportData): string {
  const trend = data.smartTopicTrend;
  if (trend && trend.items.length >= 2) {
    const rows = trend.items
      .map((item) => {
        const chips = item.topics
          .slice(0, 3)
          .map((t) => `<span class="topic-flow-chip" title="${escapeHtml(t.name)} ${formatNumber(t.value)}">${escapeHtml(t.name)}</span>`)
          .join("");
        return `<div class="topic-flow-row"><time>${escapeHtml(item.period)}</time><div class="topic-flow-chips">${chips}</div></div>`;
      })
      .join("");

    return `<section id="s-topicflow" class="kca-section card kca-card--data anim-enter" data-observe style="--enter-delay:0.06s" aria-label="토픽 플로우">
      <h2 class="section-glow">토픽 플로우</h2>
      <p class="chart-hint">${escapeHtml(trend.label)} — ${escapeHtml(trend.hint)}</p>
      <div class="topic-flow-table">${rows}</div>
    </section>`;
  }

  const chips = data.topics
    .slice(0, 5)
    .map((t) => `<span class="topic-flow-chip">${escapeHtml(t.title)} <small>${formatNumber(t.messagePercent)}%</small></span>`)
    .join("");

  return `<section id="s-topicflow" class="kca-section card kca-card--data anim-enter" data-observe style="--enter-delay:0.06s" aria-label="토픽 플로우">
    <h2 class="section-glow">토픽 플로우</h2>
    <p class="chart-hint">대화에서 드러난 주요 주제들의 흐름입니다.</p>
    <div class="topic-flow-table"><div class="topic-flow-row"><div class="topic-flow-chips">${chips}</div></div></div>
  </section>`;
}

export function renderActivityRestRhythm(data: ReportData): string {
  if (data.daily.length < 3) return "";
  const sorted = [...data.daily].sort((a, b) => a.date.localeCompare(b.date));
  const activeDays = sorted.filter((d) => d.count > 0);
  if (activeDays.length === 0) return "";

  const segments: Array<{
    type: "active" | "gap";
    days: number;
    messages?: number;
    start: string;
    end: string;
  }> = [];
  let run: typeof activeDays = [];
  for (const d of activeDays) {
    if (run.length === 0) {
      run.push(d);
      continue;
    }
    const prev = run[run.length - 1]!;
    const gap = dateDiffDays(prev.date, d.date) - 1;
    if (gap > 0) {
      segments.push({
        type: "active",
        days: run.length,
        messages: run.reduce((s, x) => s + x.count, 0),
        start: run[0]!.date,
        end: prev.date,
      });
      segments.push({
        type: "gap",
        days: gap,
        start: addDays(prev.date, 1),
        end: addDays(d.date, -1),
      });
      run = [d];
    } else {
      run.push(d);
    }
  }
  if (run.length) {
    segments.push({
      type: "active",
      days: run.length,
      messages: run.reduce((s, x) => s + x.count, 0),
      start: run[0]!.date,
      end: run[run.length - 1]!.date,
    });
  }

  const spanDays = Math.max(dateDiffDays(segments[0]!.start, segments[segments.length - 1]!.end) + 1, 1);
  const maxMessages = Math.max(
    ...segments.filter((s) => s.type === "active").map((s) => s.messages ?? 1),
    1,
  );

  const html = segments
    .map((s) => {
      const width = Math.max(s.type === "active" ? 4 : 2, Math.round((s.days / spanDays) * 100));
      if (s.type === "active") {
        const intensity = Math.max(20, Math.round(((s.messages ?? 0) / maxMessages) * 80));
        return `<div class="arr-seg arr-seg--active" style="--arr-w:${width}%;--arr-intensity:${intensity}%" title="${escapeHtml(s.start)}~${escapeHtml(s.end)} · ${formatNumber(s.messages ?? 0)}건 · ${s.days}일" data-observe></div>`;
      }
      return `<div class="arr-seg arr-seg--gap" style="--arr-w:${width}%;" title="침묵 ${s.days}일 (${escapeHtml(s.start)}~${escapeHtml(s.end)})" data-observe></div>`;
    })
    .join("");

  return `<section id="s-activity-rest" class="kca-section card kca-card--data activity-rest-rhythm anim-enter" data-observe style="--enter-delay:0.0575s" aria-label="활동-휴식 리듬">
    <h2 class="section-glow">활동·휴식 리듬</h2>
    <p class="chart-hint">활동일(색)과 침묵(회색)을 시간 순서대로 펼친 스트립이에요.</p>
    <div class="arr-strip" role="img" aria-label="활동과 휴식 리듬">${html}</div>
    <div class="arr-metrics">
      <div><b>최장 활동 연속</b><span class="num">${formatNumber(data.summary.longestActiveStreakDays)}일</span></div>
      <div><b>최장 침묵</b><span class="num">${formatNumber(data.insights.maxSilenceBetweenActiveDays ?? 0)}일</span></div>
    </div>
  </section>`;
}

function sampleLatencyResponders<T extends { medianMinutes: number; replies: number }>(
  responders: T[],
  target = 30,
): T[] {
  if (responders.length <= target) return responders;
  const sorted = [...responders].sort((a, b) => b.replies - a.replies);
  const top = sorted.slice(0, 10);
  const rest = sorted.slice(10);
  const slots = target - top.length;
  const picked: T[] = [];
  for (let i = 0; i < slots; i++) {
    const idx = Math.min(rest.length - 1, Math.floor((i + 0.5) * (rest.length / slots)));
    const cand = rest[idx];
    if (cand && !picked.includes(cand)) picked.push(cand);
  }
  return [...top, ...picked].sort((a, b) => a.medianMinutes - b.medianMinutes);
}

function renderReplyLatencyFingerprint(data: ReportData): string {
  const latency = data.replyLatency!;
  const total = latency.totalReplies;
  const distribution = [
    { label: "1분 미만", pct: latency.fastRatePercent, cls: "fast" },
    { label: "1~10분", pct: latency.normalRatePercent, cls: "normal" },
    { label: "10분 초과", pct: latency.slowRatePercent, cls: "slow" },
  ];
  const stacked = distribution
    .map((d) => `<span class="latency-seg latency-seg--${d.cls}" style="width:${Math.max(d.pct, 0.5).toFixed(2)}%" title="${escapeHtml(d.label)} ${formatNumber(d.pct)}%"></span>`)
    .join("");
  const display = sampleLatencyResponders(latency.responders);
  const maxMedian = Math.max(...display.map((r) => r.medianMinutes), 0.01);
  const rows = display
    .map((r) => {
      const width =
        r.medianMinutes <= 0 ? 0 : Math.max(10, Math.min(100, (r.medianMinutes / maxMedian) * 100));
      return `<div class="latency-row" title="${escapeHtml(r.alias)}: 중앙값 ${formatNumber(r.medianMinutes)}분, P90 ${formatNumber(r.p90Minutes)}분, ${formatNumber(r.replies)}건">
        <span class="latency-alias">${escapeHtml(r.alias)}</span>
        <span class="latency-track"><span class="latency-fill" style="width:${width.toFixed(2)}%"></span></span>
        <span class="latency-num">${formatNumber(r.medianMinutes)}분</span>
      </div>`;
    })
    .join("");
  const sampledNote =
    latency.responders.length > display.length
      ? ` <small>(상위 10명 + 구간 샘플 ${display.length}명)</small>`
      : "";
  return `<section id="s-latency" class="kca-section card kca-card--data latency-fingerprint anim-enter" data-observe style="--enter-delay:0.061s" aria-label="누가 빨리 답하나">
    <h2 class="section-glow">누가 빨리 답하나</h2>
    <p class="chart-hint">상대가 말한 뒤 내가 답할 때까지 걸린 시간 — 막대가 길수록 더 늦게 답하는 편입니다.${sampledNote}</p>
    <div class="latency-summary">
      <div><b>방 중앙값</b><span class="num">${formatNumber(latency.roomMedianMinutes)}분</span></div>
      <div><b>P90</b><span class="num">${formatNumber(latency.roomP90Minutes)}분</span></div>
      <div><b>총 응답</b><span class="num">${formatNumber(total)}건</span></div>
    </div>
    <div class="latency-stacked" role="img" aria-label="응답 속도 분포">${stacked}</div>
    <div class="latency-rows latency-rows--sampled">${rows}</div>
  </section>`;
}

function renderQuestionAnswerTopology(data: ReportData): string {
  const qa = data.questionAnswer!;
  const pairCards = qa.topPairs
    .slice(0, 4)
    .map((p) => `<article class="qa-pair-card" data-observe>
      <div class="qa-pair">${escapeHtml(p.asker)} → ${escapeHtml(p.answerer)}</div>
      <div class="qa-metric"><span>질문</span><strong>${formatNumber(p.questions)}건</strong></div>
      <div class="qa-metric"><span>중앙 답변 시간</span><strong>${formatNumber(p.medianAnswerMinutes)}분</strong></div>
    </article>`)
    .join("");
  const answererChips = qa.topAnswerers
    .slice(0, 4)
    .map((a) => `<span class="qa-answerer-chip">${escapeHtml(a.alias)} <strong>${formatNumber(a.answers)}</strong></span>`)
    .join("");
  return `<section id="s-qa" class="kca-section card kca-card--data qa-topology anim-enter" data-observe style="--enter-delay:0.062s" aria-label="질문-응답 지도">
    <h2 class="section-glow">질문-응답 지도</h2>
    <p class="chart-hint">물음표 메시지 뒤 60분 이내에 다른 참여자가 답한 흐름입니다.</p>
    <div class="qa-summary">
      <div><b>총 질문</b><span class="num">${formatNumber(qa.totalQuestions)}건</span></div>
      <div><b>답변율</b><span class="num">${formatNumber(qa.answerRatePercent)}%</span></div>
      <div><b>중앙 답변 시간</b><span class="num">${formatNumber(qa.medianAnswerMinutes)}분</span></div>
    </div>
    <div class="qa-pair-grid" role="list">${pairCards}</div>
    <div class="qa-answerers"><h4>🏆 상위 답변자</h4><div class="qa-answerer-chips">${answererChips}</div></div>
  </section>`;
}

function renderBurstAnatomy(data: ReportData): string {
  const cards = data.burstAnatomy
    .map((b) => {
      const participants = b.participants.map((p) => `<span class="burst-participant">${escapeHtml(p)}</span>`).join("");
      const keywords = b.topKeywords.map((k) => `<span class="burst-keyword">${escapeHtml(k)}</span>`).join("");
      return `<article class="burst-anatomy-card" data-observe>
        <time datetime="${escapeHtml(b.date)}">${escapeHtml(b.date)}</time>
        <div class="burst-metric"><span>메시지</span><strong>${formatNumber(b.messages)}건</strong></div>
        <div class="burst-metric"><span>평소 대비</span><strong>${formatNumber(b.vsAverage)}배</strong></div>
        <div class="burst-row"><span>참여자</span><div class="burst-participants">${participants}</div></div>
        <div class="burst-row"><span>핵심 키워드</span><div class="burst-keywords">${keywords}</div></div>
      </article>`;
    })
    .join("");
  return `<section id="s-burst-anatomy" class="kca-section card kca-card--data burst-anatomy anim-enter" data-observe style="--enter-delay:0.063s" aria-label="대화가 몰린 날">
    <h2 class="section-glow">대화가 몰린 날</h2>
    <p class="chart-hint">평소보다 메시지가 훨씬 많았던 날 — 누가 말했고 무슨 주제였는지 모아봤어요.</p>
    <div class="burst-anatomy-grid" role="list">${cards}</div>
  </section>`;
}

function renderKeywordGravity(data: ReportData): string {
  const items = data.keywordGravity.slice(0, 6);
  const maxGravity = Math.max(...items.map((k) => k.gravity), 1);
  const rows = items
    .map((k) => {
      const width = Math.min(100, (k.gravity / maxGravity) * 100);
      const coChips = k.topCoKeywords.map((c) => `<span class="kg-co">${escapeHtml(c)}</span>`).join("");
      return `<article class="kg-card" data-observe>
        <div class="kg-header">
          <span class="kg-label">${escapeHtml(k.label)}</span>
          <span class="kg-gravity">${formatNumber(k.gravity)}</span>
        </div>
        <div class="kg-bar"><span class="kg-fill" style="width:${width.toFixed(2)}%"></span></div>
        <div class="kg-meta">
          <span>등장 ${formatNumber(k.appearances)}회</span>
          <span>후속 ${formatNumber(k.followUpMessages)}건</span>
          <span>중앙 ${formatNumber(k.medianFollowUpMinutes)}분</span>
        </div>
        ${coChips ? `<div class="kg-co-list">${coChips}</div>` : ""}
      </article>`;
    })
    .join("");
  return `<section id="s-keyword-gravity" class="kca-section card kca-card--data keyword-gravity anim-enter" data-observe style="--enter-delay:0.064s" aria-label="키워드 중력">
    <h2 class="section-glow">키워드 중력</h2>
    <p class="chart-hint">단어가 나온 뒤 <strong>10분 이내</strong>에 몇 개의 메시지가 이어지는지 — 대화를 끌어당기는 핵심 키워드입니다.</p>
    <div class="kg-grid" role="list">${rows}</div>
  </section>`;
}

function parseYmdTs(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

function dateDiffDays(a: string, b: string): number {
  return Math.round((parseYmdTs(b) - parseYmdTs(a)) / 86_400_000);
}

function addDays(date: string, n: number): string {
  const ts = parseYmdTs(date) + n * 86_400_000;
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
