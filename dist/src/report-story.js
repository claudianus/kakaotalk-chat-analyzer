import { escapeHtml, formatNumber, renderHighlightLine } from "./report-util.js";
const CHAPTER_GAP_DAYS = 7;
export const STORY_CSS = `
    #s-wrapped, #s-personas, #s-chapters, #s-calendar { scroll-margin-top: 76px; }
    .story-headline {
      margin: 0 0 14px;
      font-size: clamp(17px, 2.5vw, 21px);
      line-height: 1.55;
      font-weight: 650;
      color: var(--ink);
      max-width: 48ch;
    }
    .wrapped-section { margin-bottom: 20px; }
    .wrapped-section h2 { margin: 0 0 6px; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
    .wrapped-lede { margin: 0 0 14px; font-size: 13px; color: var(--muted); line-height: 1.5; }
    .wrapped-deck {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
      padding: 0;
    }
    .wrapped-card {
      border-radius: 18px;
      border: 1px solid var(--line);
      padding: 22px 20px;
      min-height: 200px;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      background: linear-gradient(155deg, rgba(15, 107, 92, 0.14), rgba(196, 92, 42, 0.08));
      box-shadow: var(--shadow);
      position: relative;
      overflow: hidden;
    }
    .wrapped-card::before {
      content: attr(data-emoji);
      position: absolute;
      top: 12px;
      right: 14px;
      font-size: 2.4rem;
      opacity: 0.35;
      line-height: 1;
    }
    .wrapped-card-kicker {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
      margin: 0 0 6px;
    }
    .wrapped-card-stat {
      margin: 0;
      font-size: clamp(32px, 6vw, 44px);
      font-weight: 900;
      letter-spacing: -0.04em;
      line-height: 1.05;
      color: var(--ink);
      word-break: break-word;
    }
    .wrapped-card-sub {
      margin: 10px 0 0;
      font-size: 13px;
      line-height: 1.5;
      color: var(--muted);
    }
    .persona-grid {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    }
    .persona-chip {
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: var(--panel);
    }
    .persona-chip strong {
      display: block;
      font-size: 14px;
      color: var(--ink);
      margin-bottom: 4px;
    }
    .persona-chip em {
      display: block;
      font-style: normal;
      font-size: 12px;
      font-weight: 800;
      color: var(--accent);
      margin-bottom: 4px;
    }
    .persona-chip span { font-size: 11px; color: var(--muted); line-height: 1.4; }
    .chapter-list { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
    .chapter-item {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 10px 14px;
      align-items: center;
      padding: 14px 16px;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: var(--panel);
    }
    @media (max-width: 560px) {
      .chapter-item { grid-template-columns: auto 1fr; }
      .chapter-item .chapter-stat { grid-column: 1 / -1; text-align: left; }
    }
    .chapter-badge {
      font-size: 12px;
      font-weight: 900;
      color: var(--accent);
      min-width: 2.5rem;
    }
    .chapter-meta { font-size: 13px; line-height: 1.45; color: var(--ink); }
    .chapter-meta small { display: block; color: var(--muted); font-size: 11px; margin-top: 4px; }
    .chapter-stat { text-align: right; font-size: 13px; font-weight: 750; color: var(--muted); font-variant-numeric: tabular-nums; }
    .cal-wrap { width: 100%; max-width: 100%; padding-bottom: 4px; }
    .cal-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 4px;
      align-items: flex-start;
      width: 100%;
    }
    .cal-week { display: grid; grid-template-rows: repeat(7, minmax(0, 1fr)); gap: 2px; }
    .cal-cell {
      width: clamp(8px, 2.2vw, 12px);
      height: clamp(8px, 2.2vw, 12px);
      border-radius: 3px;
      border: 1px solid transparent;
      display: block;
    }
    .cal-cell[data-level="0"] { background: var(--bar-bg); border-color: var(--line); }
    .cal-cell[data-level="1"] { background: rgba(15, 107, 92, 0.25); }
    .cal-cell[data-level="2"] { background: rgba(15, 107, 92, 0.45); }
    .cal-cell[data-level="3"] { background: rgba(15, 107, 92, 0.65); }
    .cal-cell[data-level="4"] { background: var(--accent); }
    :root[data-theme="dark"] .cal-cell[data-level="1"] { background: rgba(62, 232, 197, 0.2); }
    :root[data-theme="dark"] .cal-cell[data-level="2"] { background: rgba(62, 232, 197, 0.35); }
    :root[data-theme="dark"] .cal-cell[data-level="3"] { background: rgba(62, 232, 197, 0.55); }
    .cal-legend {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 10px;
      font-size: 11px;
      color: var(--muted);
    }
    .cal-legend i { display: inline-flex; gap: 2px; align-items: center; }
    .cal-legend span { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }

`;
export function renderStorySections(data) {
    const s = data.story;
    const parts = [];
    parts.push(`<section id="s-wrapped" class="wrapped-section anim-enter" style="--enter-delay:0.02s" aria-label="대화 Wrapped">
    <h2>⓪ ${escapeHtml(data.source.chatRoomName)} Wrapped</h2>
    <p class="wrapped-lede">핵심 장면 카드가 화면 너비에 맞게 배열됩니다. 원문 메시지는 없습니다.</p>
    <div class="wrapped-deck" role="list">
      ${s.wrapped
        .map((c) => `<article class="wrapped-card" role="listitem" data-emoji="${escapeHtml(c.emoji)}" aria-label="${escapeHtml(c.title)}">
        <p class="wrapped-card-kicker">${escapeHtml(c.title)}</p>
        <p class="wrapped-card-stat">${escapeHtml(c.stat)}</p>
        <p class="wrapped-card-sub">${escapeHtml(c.sub)}</p>
      </article>`)
        .join("")}
    </div>
  </section>`);
    if (s.personas.length > 0) {
        parts.push(`<section id="s-personas" class="card anim-enter" style="margin-bottom:14px;--enter-delay:0.04s">
      <h2>참여자 아키타입</h2>
      <p class="chart-hint">이름은 마스킹된 표시명이고, <strong>통계만</strong>으로 붙인 재미 라벨이에요.</p>
      <div class="persona-grid">
        ${s.personas
            .map((p) => `<div class="persona-chip">
          <strong>${escapeHtml(p.alias)}</strong>
          <em>${escapeHtml(p.title)}</em>
          <span>${escapeHtml(p.reason)}</span>
        </div>`)
            .join("")}
      </div>
    </section>`);
    }
    if (s.chapters.length > 1) {
        parts.push(`<section id="s-chapters" class="card anim-enter" style="margin-bottom:14px;--enter-delay:0.045s">
      <h2>대화 챕터</h2>
      <p class="chart-hint"><strong>${CHAPTER_GAP_DAYS}일 이상</strong> 쉬면 새 챕터로 나눴어요. 각 구간의 주인공과 메시지 비중만 보여 줍니다.</p>
      <ul class="chapter-list">
        ${s.chapters
            .map((ch) => `<li class="chapter-item">
          <span class="chapter-badge">${escapeHtml(ch.label)}</span>
          <div class="chapter-meta">
            ${escapeHtml(ch.fromDate)} ~ ${escapeHtml(ch.toDate)}
            <small>${ch.activeDays}일 · ${formatNumber(ch.messages)}건${ch.topAlias ? ` · 주도 ${escapeHtml(ch.topAlias)} (${ch.topSharePercent}%)` : ""}</small>
          </div>
          <span class="chapter-stat">전체 ${ch.shareOfAll}%</span>
        </li>`)
            .join("")}
      </ul>
    </section>`);
    }
    if (s.calendarWeeks.length > 0) {
        parts.push(`<section id="s-calendar" class="card anim-enter" style="margin-bottom:14px;--enter-delay:0.05s">
      <h2>연간 활동 그리드</h2>
      <p class="chart-hint">GitHub 잔디처럼 <strong>날짜별 메시지 밀도</strong>예요. ${escapeHtml(s.calendarSpanLabel)}</p>
      <div class="cal-wrap">
        <div class="cal-grid" role="img" aria-label="일별 활동 히트맵">
          ${s.calendarWeeks
            .map((w) => `<div class="cal-week">
            ${w.cells
            .map((c) => {
            const title = c.date && c.count > 0
                ? `${c.date}: ${c.count}건`
                : c.date
                    ? c.date
                    : "";
            return `<span class="cal-cell" data-level="${c.level}"${title ? ` title="${escapeHtml(title)}"` : ""}></span>`;
        })
            .join("")}
          </div>`)
            .join("")}
        </div>
      </div>
      <div class="cal-legend" aria-hidden="true">
        <span>적음</span>
        <i><span style="background:var(--bar-bg);border:1px solid var(--line)"></span><span style="background:rgba(15,107,92,0.35)"></span><span style="background:rgba(15,107,92,0.65)"></span><span style="background:var(--accent)"></span></i>
        <span>많음</span>
      </div>
    </section>`);
    }
    return parts.join("\n");
}
export function storyNavLinks(data) {
    const links = [`<a href="#s-wrapped" data-kca-jump="s-wrapped">⓪ Wrapped</a>`];
    if (data.story.personas.length > 0)
        links.push(`<a href="#s-personas" data-kca-jump="s-personas">페르소나</a>`);
    if (data.story.chapters.length > 1)
        links.push(`<a href="#s-chapters" data-kca-jump="s-chapters">챕터</a>`);
    if (data.story.calendarWeeks.length > 0)
        links.push(`<a href="#s-calendar" data-kca-jump="s-calendar">연간 그리드</a>`);
    return links.join("\n    ");
}
export function renderStoryHeadline(data) {
    return `<p class="story-headline">${renderHighlightLine(data.story.headline)}</p>`;
}
export function buildOgDescription(data) {
    const s = data.summary;
    return `${data.source.chatRoomName} · 메시지 ${formatNumber(s.totalMessages)}건 · 활동 ${s.activeDays}일 · 리듬 ${data.insights.rhythmScore}점`;
}
//# sourceMappingURL=report-story.js.map