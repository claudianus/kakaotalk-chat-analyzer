import type { ReportData } from "./types.js";
import { escapeHtml, formatNumber, renderHighlightLine } from "./report-util.js";

export const GH_CONTRIB_SCRIPT = `
    (function () {
      var box = document.querySelector(".gh-contrib");
      if (!box) return;
      var tip = box.querySelector("[data-gh-tip]");
      var text = box.querySelector("[data-gh-tip-text]");
      if (!tip || !text) return;
      var cells = box.querySelectorAll(".gh-cal-cell[data-date]");
      function place(clientX, clientY) {
        var r = box.getBoundingClientRect();
        var x = clientX - r.left;
        var y = clientY - r.top - 10;
        tip.style.left = Math.max(8, Math.min(x, r.width - 8)) + "px";
        tip.style.top = Math.max(8, y) + "px";
      }
      function show(cell, clientX, clientY) {
        var label = cell.getAttribute("data-label");
        if (!label) return;
        text.textContent = label;
        tip.removeAttribute("hidden");
        box.classList.add("gh-tip-on");
        place(clientX, clientY);
      }
      function hide() {
        box.classList.remove("gh-tip-on");
        tip.setAttribute("hidden", "");
      }
      cells.forEach(function (cell) {
        cell.addEventListener("mouseenter", function (ev) {
          show(cell, ev.clientX, ev.clientY);
        });
        cell.addEventListener("mousemove", function (ev) {
          if (box.classList.contains("gh-tip-on")) place(ev.clientX, ev.clientY);
        });
        cell.addEventListener("mouseleave", hide);
        cell.addEventListener("focus", function () {
          var r = cell.getBoundingClientRect();
          show(cell, r.left + r.width / 2, r.top);
        });
        cell.addEventListener("blur", hide);
      });
    })();
`;

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

    /* GitHub contribution graph (잔디) */
    :root {
      --gh-cell-size: 11px;
      --gh-cell-gap: 3px;
      --gh-cell-0: #ebedf0;
      --gh-cell-1: #9be9a8;
      --gh-cell-2: #40c463;
      --gh-cell-3: #30a14e;
      --gh-cell-4: #216e39;
    }
    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) {
        --gh-cell-0: #161b22;
        --gh-cell-1: #0e4429;
        --gh-cell-2: #006d32;
        --gh-cell-3: #26a641;
        --gh-cell-4: #39d353;
      }
    }
    :root[data-theme="dark"] {
      --gh-cell-0: #161b22;
      --gh-cell-1: #0e4429;
      --gh-cell-2: #006d32;
      --gh-cell-3: #26a641;
      --gh-cell-4: #39d353;
    }
    :root[data-theme="light"] {
      --gh-cell-0: #ebedf0;
      --gh-cell-1: #9be9a8;
      --gh-cell-2: #40c463;
      --gh-cell-3: #30a14e;
      --gh-cell-4: #216e39;
    }
    .gh-contrib {
      position: relative;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 16px 18px 14px;
      background: var(--panel);
    }
    .gh-cal-tooltip {
      position: absolute;
      z-index: 20;
      transform: translate(-50%, -100%);
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 650;
      line-height: 1.35;
      white-space: nowrap;
      color: #fff;
      background: #24292f;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.12s ease;
    }
    .gh-contrib.gh-tip-on .gh-cal-tooltip { opacity: 1; }
    :root[data-theme="dark"] .gh-cal-tooltip {
      background: #f0f6fc;
      color: #0d1117;
    }
    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) .gh-cal-tooltip {
        background: #f0f6fc;
        color: #0d1117;
      }
    }
    .gh-contrib-summary {
      margin: 0 0 12px;
      font-size: 14px;
      line-height: 1.4;
      color: var(--muted);
    }
    .gh-contrib-summary strong {
      font-weight: 600;
      color: var(--ink);
      font-variant-numeric: tabular-nums;
    }
    .gh-contrib-span {
      display: block;
      margin-top: 4px;
      font-size: 11px;
      color: var(--muted);
    }
    .gh-cal-scroll {
      overflow-x: auto;
      overflow-y: hidden;
      max-width: 100%;
      -webkit-overflow-scrolling: touch;
      padding-bottom: 2px;
    }
    .gh-cal-graph {
      display: grid;
      grid-template-areas:
        ". months"
        "days weeks";
      grid-template-columns: max-content max-content;
      column-gap: 8px;
      row-gap: 4px;
      width: max-content;
      min-width: min(100%, max-content);
    }
    .gh-cal-days {
      grid-area: days;
      display: grid;
      grid-template-rows: repeat(7, var(--gh-cell-size));
      gap: var(--gh-cell-gap);
      align-items: center;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 9px;
      line-height: 1;
      color: var(--muted);
      padding-right: 2px;
    }
    .gh-cal-days span {
      height: var(--gh-cell-size);
      display: flex;
      align-items: center;
    }
    .gh-cal-days span:empty { visibility: hidden; }
    .gh-cal-months {
      grid-area: months;
      display: grid;
      grid-template-columns: repeat(var(--gh-weeks), var(--gh-cell-size));
      gap: var(--gh-cell-gap);
      height: 14px;
      align-items: end;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 9px;
      line-height: 1;
      color: var(--muted);
    }
    .gh-cal-month {
      grid-column: span 1;
      white-space: nowrap;
      overflow: visible;
    }
    .gh-cal-weeks {
      grid-area: weeks;
      display: grid;
      grid-template-columns: repeat(var(--gh-weeks), var(--gh-cell-size));
      grid-template-rows: repeat(7, var(--gh-cell-size));
      gap: var(--gh-cell-gap);
      grid-auto-flow: column;
    }
    .gh-cal-cell {
      width: var(--gh-cell-size);
      height: var(--gh-cell-size);
      border-radius: 2px;
      background: var(--gh-cell-0);
      display: block;
      padding: 0;
      margin: 0;
      appearance: none;
      font: inherit;
      cursor: default;
      transition: transform 0.1s ease, box-shadow 0.1s ease, outline 0.1s ease;
    }
    .gh-cal-cell[data-date] {
      cursor: pointer;
    }
    .gh-cal-cell[data-date]:hover,
    .gh-cal-cell[data-date]:focus-visible {
      transform: scale(1.45);
      z-index: 5;
      position: relative;
      outline: 2px solid var(--accent);
      outline-offset: 1px;
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--panel) 80%, transparent);
    }
    .gh-cal-cell[data-level="1"] { background: var(--gh-cell-1); }
    .gh-cal-cell[data-level="2"] { background: var(--gh-cell-2); }
    .gh-cal-cell[data-level="3"] { background: var(--gh-cell-3); }
    .gh-cal-cell[data-level="4"] { background: var(--gh-cell-4); }
    .gh-cal-cell[data-level="0"] { background: var(--gh-cell-0); border: 1px solid color-mix(in srgb, var(--line) 70%, transparent); }
    .gh-cal-cell--pad {
      pointer-events: none;
      border: none;
    }
    .gh-cal-legend {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
      margin-top: 12px;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 11px;
      color: var(--muted);
    }
    .gh-cal-legend-scale {
      display: inline-flex;
      gap: var(--gh-cell-gap);
      align-items: center;
      margin: 0 2px;
    }
    .gh-cal-legend-scale i {
      width: var(--gh-cell-size);
      height: var(--gh-cell-size);
      border-radius: 2px;
      display: block;
      font-style: normal;
      background: var(--gh-cell-0);
    }
    .gh-cal-legend-scale i[data-level="1"] { background: var(--gh-cell-1); }
    .gh-cal-legend-scale i[data-level="2"] { background: var(--gh-cell-2); }
    .gh-cal-legend-scale i[data-level="3"] { background: var(--gh-cell-3); }
    .gh-cal-legend-scale i[data-level="4"] { background: var(--gh-cell-4); }

`;

function renderGitHubCalendar(data: ReportData): string {
  const s = data.story;
  const weekCount = s.calendarWeeks.length;
  if (weekCount === 0) return "";

  const monthCells = Array.from({ length: weekCount }, (_, wi) => {
    const hit = s.calendarMonthLabels.find((m) => m.weekIndex === wi);
    return `<span class="gh-cal-month">${hit ? escapeHtml(hit.label) : ""}</span>`;
  }).join("");

  const dayLabels = ["", "월", "", "수", "", "금", ""]
    .map((d) => `<span>${d}</span>`)
    .join("");

  const cells = s.calendarWeeks
    .flatMap((w) => w.cells)
    .map((c) => {
      if (!c.date) {
        return `<span class="gh-cal-cell gh-cal-cell--pad" data-level="0" aria-hidden="true"></span>`;
      }
      const label =
        c.count > 0
          ? `${formatCalendarDate(c.date)} · ${formatNumber(c.count)}건`
          : `${formatCalendarDate(c.date)} · 활동 없음`;
      return `<button type="button" class="gh-cal-cell" data-level="${c.level}" data-date="${escapeHtml(c.date)}" data-count="${c.count}" data-label="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"></button>`;
    })
    .join("");

  const summary =
    s.calendarTotalMessages > 0
      ? `<p class="gh-contrib-summary">이 기간 메시지 <strong>${formatNumber(s.calendarTotalMessages)}</strong>건<span class="gh-contrib-span">${escapeHtml(s.calendarSpanLabel)}</span></p>`
      : `<p class="gh-contrib-summary">이 기간 활동 없음<span class="gh-contrib-span">${escapeHtml(s.calendarSpanLabel)}</span></p>`;

  return `<div class="gh-contrib">
    <div class="gh-cal-tooltip" data-gh-tip hidden><span data-gh-tip-text></span></div>
    ${summary}
    <div class="gh-cal-scroll">
      <div class="gh-cal-graph" style="--gh-weeks:${weekCount}" role="group" aria-label="일별 활동 히트맵">
        <div class="gh-cal-months" aria-hidden="true">${monthCells}</div>
        <div class="gh-cal-days" aria-hidden="true">${dayLabels}</div>
        <div class="gh-cal-weeks">${cells}</div>
      </div>
    </div>
    <footer class="gh-cal-legend" aria-hidden="true">
      <span>적음</span>
      <span class="gh-cal-legend-scale">
        <i data-level="0"></i><i data-level="1"></i><i data-level="2"></i><i data-level="3"></i><i data-level="4"></i>
      </span>
      <span>많음</span>
    </footer>
  </div>`;
}

export function renderStorySections(data: ReportData): string {
  const s = data.story;
  const parts: string[] = [];

  parts.push(`<section id="s-wrapped" class="wrapped-section anim-enter" style="--enter-delay:0.02s" aria-label="대화 Wrapped">
    <h2>⓪ ${escapeHtml(data.source.chatRoomName)} Wrapped</h2>
    <p class="wrapped-lede">핵심 장면 카드가 화면 너비에 맞게 배열됩니다. 원문 메시지는 없습니다.</p>
    <div class="wrapped-deck" role="list">
      ${s.wrapped
        .map(
          (c) => `<article class="wrapped-card" role="listitem" data-emoji="${escapeHtml(c.emoji)}" aria-label="${escapeHtml(c.title)}">
        <p class="wrapped-card-kicker">${escapeHtml(c.title)}</p>
        <p class="wrapped-card-stat">${escapeHtml(c.stat)}</p>
        <p class="wrapped-card-sub">${escapeHtml(c.sub)}</p>
      </article>`,
        )
        .join("")}
    </div>
  </section>`);

  if (s.personas.length > 0) {
    parts.push(`<section id="s-personas" class="card anim-enter" style="margin-bottom:14px;--enter-delay:0.04s">
      <h2>참여자 아키타입</h2>
      <p class="chart-hint">이름은 마스킹된 표시명이고, <strong>통계만</strong>으로 붙인 재미 라벨이에요.</p>
      <div class="persona-grid">
        ${s.personas
          .map(
            (p) => `<div class="persona-chip">
          <strong>${escapeHtml(p.alias)}</strong>
          <em>${escapeHtml(p.title)}</em>
          <span>${escapeHtml(p.reason)}</span>
        </div>`,
          )
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
          .map(
            (ch) => `<li class="chapter-item">
          <span class="chapter-badge">${escapeHtml(ch.label)}</span>
          <div class="chapter-meta">
            ${escapeHtml(ch.fromDate)} ~ ${escapeHtml(ch.toDate)}
            <small>${ch.activeDays}일 · ${formatNumber(ch.messages)}건${ch.topAlias ? ` · 주도 ${escapeHtml(ch.topAlias)} (${ch.topSharePercent}%)` : ""}</small>
          </div>
          <span class="chapter-stat">전체 ${ch.shareOfAll}%</span>
        </li>`,
          )
          .join("")}
      </ul>
    </section>`);
  }

  if (s.calendarWeeks.length > 0) {
    parts.push(`<section id="s-calendar" class="anim-enter" style="margin-bottom:14px;--enter-delay:0.05s">
      <h2 style="margin:0 0 6px;font-size:20px;font-weight:800;letter-spacing:-0.02em">연간 활동 그리드</h2>
      <p class="chart-hint" style="margin-bottom:12px">GitHub 프로필 <strong>Contributions</strong>와 같은 레이아웃·색 단계예요. 셀에 마우스를 올리거나 탭하면 날짜와 건수가 표시됩니다.</p>
      ${renderGitHubCalendar(data)}
    </section>`);
  }

  return parts.join("\n");
}

export function storyNavLinks(data: ReportData): string {
  const links = [`<a href="#s-wrapped" data-kca-jump="s-wrapped">⓪ Wrapped</a>`];
  if (data.story.personas.length > 0) links.push(`<a href="#s-personas" data-kca-jump="s-personas">페르소나</a>`);
  if (data.story.chapters.length > 1) links.push(`<a href="#s-chapters" data-kca-jump="s-chapters">챕터</a>`);
  if (data.story.calendarWeeks.length > 0) links.push(`<a href="#s-calendar" data-kca-jump="s-calendar">연간 그리드</a>`);
  return links.join("\n    ");
}

export function renderStoryHeadline(data: ReportData): string {
  return `<p class="story-headline">${renderHighlightLine(data.story.headline)}</p>`;
}

export function buildOgDescription(data: ReportData): string {
  const s = data.summary;
  return `${data.source.chatRoomName} · 메시지 ${formatNumber(s.totalMessages)}건 · 활동 ${s.activeDays}일 · 리듬 ${data.insights.rhythmScore}점`;
}

function formatCalendarDate(ymd: string): string {
  const p = ymd.split("-");
  if (p.length !== 3) return ymd;
  const y = Number(p[0]);
  const m = Number(p[1]);
  const d = Number(p[2]);
  if (!y || !m || !d) return ymd;
  return `${y}년 ${m}월 ${d}일`;
}
