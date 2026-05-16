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
/** @deprecated styles live in src/report/css — bundled via report-styles.ts */
function renderGitHubCalendar(data) {
    const s = data.story;
    const weekCount = s.calendarWeeks.length;
    if (weekCount === 0)
        return "";
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
        const label = c.count > 0
            ? `${formatCalendarDate(c.date)} · ${formatNumber(c.count)}건`
            : `${formatCalendarDate(c.date)} · 활동 없음`;
        return `<button type="button" class="gh-cal-cell" data-level="${c.level}" data-date="${escapeHtml(c.date)}" data-count="${c.count}" data-label="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"></button>`;
    })
        .join("");
    const summary = s.calendarTotalMessages > 0
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
        parts.push(`<section id="s-calendar" class="anim-enter" style="margin-bottom:14px;--enter-delay:0.05s">
      <h2 style="margin:0 0 6px;font-size:20px;font-weight:800;letter-spacing:-0.02em">연간 활동 그리드</h2>
      <p class="chart-hint" style="margin-bottom:12px">GitHub 프로필 <strong>Contributions</strong>와 같은 레이아웃·색 단계예요. 셀에 마우스를 올리거나 탭하면 날짜와 건수가 표시됩니다.</p>
      ${renderGitHubCalendar(data)}
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
function formatCalendarDate(ymd) {
    const p = ymd.split("-");
    if (p.length !== 3)
        return ymd;
    const y = Number(p[0]);
    const m = Number(p[1]);
    const d = Number(p[2]);
    if (!y || !m || !d)
        return ymd;
    return `${y}년 ${m}월 ${d}일`;
}
//# sourceMappingURL=report-story.js.map