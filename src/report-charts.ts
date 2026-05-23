import { isShortActivitySpan, topicsThemesOnly } from "./report-chart-util.js";
import { hasCalendarHeatmap, showMonthlyChart } from "./report-section-visibility.js";
import type { ReportData } from "./types.js";
import { escapeHtml, formatNumber } from "./report-util.js";

/** @deprecated preconnect는 report-head.ts REPORT_HEAD_LINKS 사용 */
export const CHART_CDN_HEAD = ``;

/** body 끝: 차트 라이브러리 — defer 금지(인라인 init보다 반드시 먼저 실행) */
export const CHART_CDN_BODY = `
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.min.js" crossorigin="anonymous" onerror="this.onerror=null;this.src='https://unpkg.com/echarts@5.6.0/dist/echarts.min.js'"></script>
  <script src="https://cdn.jsdelivr.net/npm/echarts-wordcloud@2.1.0/dist/echarts-wordcloud.min.js" crossorigin="anonymous" onerror="this.onerror=null;this.src='https://unpkg.com/echarts-wordcloud@2.1.0/dist/echarts-wordcloud.min.js'"></script>
`;

/** @deprecated styles live in src/report/css — bundled via report-styles.ts */

export interface ChartPayload {
  hourly: number[];
  weekdays: { label: string; count: number }[];
  monthly: { label: string; count: number }[];
  daily: { date: string; count: number }[];
  keywords: { label: string; count: number }[];
  keywordsDistinctive: { label: string; count: number }[];
  domains: { label: string; count: number }[];
  participants: { alias: string; messages: number; sharePercent: number }[];
  participantsByCharacters: { alias: string; characters: number; characterSharePercent: number }[];
  sentiment: {
    positivePercent: number;
    negativePercent: number;
    neutralPercent: number;
    compoundScore: number;
  } | null;
  calendarCells: { date: string; count: number }[];
  burstDates: string[];
  totalParticipants: number;
  topicsThemes: { title: string; terms: string[]; messagePercent: number }[];
  topicsPeriods: { title: string; terms: string[]; messagePercent: number; periodLabel?: string }[];
  interaction: {
    aliases: string[];
    matrix: number[][];
    totalReplies: number;
    messageCounts?: number[];
  } | null;
  topicTrend: { period: string; topics: { name: string; value: number }[] }[];
}

export function serializeChartPayload(data: ReportData): string {
  return JSON.stringify(buildChartPayload(data))
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function buildChartPayload(data: ReportData): ChartPayload {
  return {
    hourly: data.hourly,
    weekdays: data.weekdays,
    monthly: data.monthly.map((m) => ({ label: m.date, count: m.count })),
    daily: data.daily,
    keywords: data.keywords,
    keywordsDistinctive: data.keywordsDistinctive,
    domains: data.domains.slice(0, 24),
    participants: data.participants.slice(0, 24).map((p) => ({
      alias: p.alias,
      messages: p.messages,
      sharePercent: p.sharePercent,
    })),
    participantsByCharacters: data.participantsByCharacters.slice(0, 10).map((p) => ({
      alias: p.alias,
      characters: p.characters,
      characterSharePercent: p.characterSharePercent,
    })),
    sentiment: data.sentiment
      ? {
          positivePercent: data.sentiment.positivePercent,
          negativePercent: data.sentiment.negativePercent,
          neutralPercent: data.sentiment.neutralPercent,
          compoundScore: data.sentiment.compoundScore,
        }
      : null,
    calendarCells: data.story.calendarWeeks
      .flatMap((w) => w.cells)
      .filter((c) => c.date && c.count > 0)
      .map((c) => ({ date: c.date!, count: c.count })),
    burstDates: data.burstDays.map((b) => b.date),
    totalParticipants: data.participants.length,
    topicsThemes: topicsThemesOnly(data.topics)
      .slice(0, 12)
      .map((t) => ({ title: t.title, terms: t.terms, messagePercent: t.messagePercent })),
    topicsPeriods: isShortActivitySpan(data.daily)
      ? []
      : data.topics
          .filter((t) => t.kind === "period")
          .slice(0, 4)
          .map((t) => ({
            title: t.title,
            terms: t.terms,
            messagePercent: t.messagePercent,
            periodLabel: t.periodLabel,
          })),
    interaction: data.interaction
      ? {
          aliases: data.interaction.aliases,
          matrix: data.interaction.matrix,
          totalReplies: data.interaction.totalReplies,
          messageCounts: data.interaction.messageCounts,
        }
      : null,
    topicTrend: data.topicTrend.map((t) => ({
      period: t.period,
      topics: t.topics.map((topic) => ({ name: topic.name, value: topic.value })),
    })),
  };
}

export function serializeExplorerPayload(data: ReportData): string {
  return JSON.stringify(data.explorer)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function renderChartDeck(data: ReportData): string {
  const kw = data.keywords.length;
  const themeCount = topicsThemesOnly(data.topics).length;
  const showDailyHeat = !hasCalendarHeatmap(data);
  const showMonthly = showMonthlyChart(data);
  const topicChart =
    themeCount > 0
      ? `<article class="viz-card kca-card--chart span-12">
      <h3>대화 테마 · c-TF-IDF</h3>
      <p class="viz-hint">막대 = <strong>의미 주제</strong> 신호 비중(근사 %). 월별 메시지량은 「기간 비교」·아래 주제 카드의 월별 화제를 보세요.</p>
      <div id="chart-topics" class="chart-box" role="img" aria-label="주제 테마 차트"></div>
    </article>`
      : "";

  return `<section id="s-viz" class="kca-section viz-hero anim-enter" style="--enter-delay:0.055s" aria-label="인터랙티브 차트">
    <h2>📊 인터랙티브 차트</h2>
    <p>ECharts 기반 — 막대·히트맵·워드클라우드에 마우스를 올리면 수치를 확인할 수 있어요. 키워드 <strong>${formatNumber(kw)}</strong>개(메시지 등장 횟수 기준).</p>
  </section>
  <div class="viz-grid anim-enter" style="--enter-delay:0.06s">
    <article class="viz-card kca-card--chart span-8">
      <h3>키워드 워드클라우드</h3>
      <p class="viz-hint">글자 크기 = 메시지 등장 빈도. Kiwi·BM25로 뽑은 본문 키워드입니다.</p>
      <div id="chart-kw-cloud" class="chart-box tall" role="img" aria-label="키워드 워드클라우드"></div>
    </article>
    <article class="viz-card kca-card--chart span-4">
      <h3>시간대 분포</h3>
      <p class="viz-hint">0~23시 메시지량</p>
      <div id="chart-hours" class="chart-box compact" role="img" aria-label="시간대 차트"></div>
    </article>
    ${
      showDailyHeat
        ? `<article class="viz-card kca-card--chart span-6">
      <h3>일별 활동 히트맵</h3>
      <p class="viz-hint">활동 기간만 표시 · 급증일 강조</p>
      <div id="chart-daily-heat" class="chart-box" role="img" aria-label="일별 히트맵"></div>
    </article>`
        : ""
    }
    <article class="viz-card kca-card--chart span-6">
      <h3>요일 분포</h3>
      <p class="viz-hint">요일별 메시지량</p>
      <div id="chart-weekday" class="chart-box compact" role="img" aria-label="요일 차트"></div>
      ${
        showMonthly
          ? `<h3 class="viz-sub-title">월별 추이</h3>
      <p class="viz-hint">월 단위 합계</p>
      <div id="chart-monthly" class="chart-box compact" role="img" aria-label="월별 차트"></div>`
          : ""
      }
    </article>
    <article class="viz-card kca-card--chart span-12">
      <h3>키워드 순위 · 메시지 등장 횟수</h3>
      <p class="viz-hint">막대 길이 = 1위 대비 비율 · 전체 ${formatNumber(kw)}개 · 워드클라우드는 위 카드</p>
      <div class="kw-sort-toggle" role="group" aria-label="키워드 정렬">
        <button type="button" class="kw-sort-btn is-active" data-kw-sort="freq" aria-pressed="true">빈도 순</button>
        <button type="button" class="kw-sort-btn" data-kw-sort="distinct" aria-pressed="false">특이어 순</button>
      </div>
      <div id="kw-ranked-host">
        <div id="kw-ranked-freq">${renderKeywordRankedList(data.keywords)}</div>
        <div id="kw-ranked-distinct" hidden>${renderKeywordRankedList(data.keywordsDistinctive)}</div>
      </div>
    </article>
    <article class="viz-card kca-card--chart span-12">
      <h3>공유 도메인</h3>
      <p class="viz-hint">링크 호스트 상위</p>
      <div id="chart-domains" class="chart-box" role="img" aria-label="도메인 차트"></div>
    </article>
    ${data.interaction ? `<article class="viz-card kca-card--chart span-12">
      <h3>응답 관계 네트워크</h3>
      <p class="viz-hint">누가 누구에게 답하는지 <strong>원형 아크 다이어그램</strong>으로 보여줍니다. 화살표 = 응답 방향, 선 굵기 = 응답 횟수, 노드 크기 = 응답 총량입니다.</p>
      <div id="chart-network-insight" class="network-insight" aria-live="polite"></div>
      <div class="network-controls">
        <label class="network-filter-label">
          <span>최소 응답</span>
          <input type="range" id="network-threshold" min="1" max="500" value="3" class="network-threshold-slider" aria-label="최소 응답 횟수 필터">
          <span id="network-threshold-val" class="network-threshold-value">3</span>
          <span>회 이상</span>
        </label>
      </div>
      <div id="chart-network" class="chart-box chart-box--network" role="img" aria-label="응답 관계 네트워크"></div>
      <div id="chart-network-empty" class="network-empty" hidden aria-hidden="true">표시할 응답 관계가 없습니다. 최소 응답 횟수를 낮춰보세요.</div>
    </article>` : ""}
    ${topicChart}
    ${renderTopicTrendCard(data)}
  </div>`;
}

function renderTopicTrendCard(data: ReportData): string {
  if (data.topicTrend.length < 2) return "";
  return `<article class="viz-card kca-card--chart span-12">
      <h3>토픽 트랜드 · 월별 키워드</h3>
      <p class="viz-hint">월별 상위 키워드 등장 횟수 추이. 스택드 에어리어 차트입니다.</p>
      <div id="chart-topic-trend" class="chart-box" role="img" aria-label="토픽 트랜드 차트"></div>
    </article>`;
}

function renderParticipantLegend(
  participants: { alias: string; messages: number; sharePercent: number }[],
): string {
  if (participants.length === 0) return "";
  const rows = participants
    .slice(0, 12)
    .map(
      (p) =>
        `<li><span class="pie-legend-name" title="${escapeHtml(p.alias)}">${escapeHtml(p.alias)}</span><span class="pie-legend-pct">${formatNumber(p.messages)} · ${p.sharePercent}%</span></li>`,
    )
    .join("");
  return `<ul class="pie-legend" aria-label="참여자 범례">${rows}</ul>`;
}

function kwBarFillClass(rankIndex: number): string {
  if (rankIndex === 0) return "kw-bar-fill kw-bar-fill--rank1";
  if (rankIndex === 1) return "kw-bar-fill kw-bar-fill--rank2";
  if (rankIndex === 2) return "kw-bar-fill kw-bar-fill--rank3";
  return "kw-bar-fill";
}

function renderKeywordRankedList(items: { label: string; count: number }[]): string {
  if (items.length === 0) return "";
  const max = Math.max(items[0]?.count ?? 0, 1);
  const rows = items
    .map((item, i) => {
      const width = Math.max(2, Math.round((item.count / max) * 100));
      const fillClass = kwBarFillClass(i);
      return `<tr>
        <td class="kw-rank num">${i + 1}</td>
        <td class="kw-label" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</td>
        <td class="kw-bar-cell">
          <div class="kw-bar-track" role="meter" aria-valuenow="${item.count}" aria-valuemin="0" aria-valuemax="${max}" aria-label="${escapeHtml(item.label)} 메시지 ${formatNumber(item.count)}건">
            <span class="${fillClass}" style="width:${width}%"></span>
          </div>
        </td>
        <td class="num">${formatNumber(item.count)}</td>
      </tr>`;
    })
    .join("");
  return `<div class="kw-table-wrap"><table class="kw-table kw-table--ranked"><colgroup><col class="kw-col-rank" /><col class="kw-col-label" /><col class="kw-col-bar" /><col class="kw-col-count" /></colgroup><thead><tr><th>#</th><th>키워드</th><th>비율</th><th class="num">메시지 수</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

export const CHARTS_INIT_SCRIPT = `
    (function () {
      var kcaDyadBoot = function () {};
      function run() {
      var dataEl = document.getElementById("kca-chart-data");
      if (!dataEl) return;
      if (typeof echarts === "undefined") return;
      var data;
      try { data = JSON.parse(dataEl.textContent || "{}"); } catch (e) { return; }

      function cssVar(name, fallback) {
        try {
          var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
          return v || fallback;
        } catch (e) { return fallback; }
      }
      function isDarkTheme() {
        return document.documentElement.getAttribute("data-theme") === "dark" ||
          (!document.documentElement.getAttribute("data-theme") &&
            window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
      }
      var dark, text, muted, accent, accent2, heatLo, heatHi, wdColors;

      function baseOpt() {
        return {
          textStyle: { color: text, fontFamily: "Pretendard, Apple SD Gothic Neo, sans-serif" },
          tooltip: { trigger: "axis", backgroundColor: dark ? "#1c2128" : "#fff", borderColor: "transparent" },
        };
      }

      var charts = [];
      var dyadChartStarted = false;
      function disposeCharts() {
        dyadChartStarted = false;
        charts.forEach(function (c) {
          try { c.dispose(); } catch (e) {}
        });
        charts.length = 0;
      }
      function markDyadReady(el) {
        el.classList.remove("is-loading");
        el.classList.add("is-ready");
        el.setAttribute("aria-busy", "false");
        var sk = el.querySelector(".chart-skeleton");
        if (sk) sk.remove();
      }
      function initDyadChart(data) {
        if (!data.interaction || !data.interaction.aliases.length) return null;
        var el = document.getElementById("chart-dyad");
        if (!el) return null;
        var ix = data.interaction;
        var dg = layout(el);
        var heat = [];
        var maxV = 1;
        for (var ri = 0; ri < ix.matrix.length; ri += 1) {
          for (var ci = 0; ci < ix.matrix[ri].length; ci += 1) {
            var v = ix.matrix[ri][ci];
            if (v > maxV) maxV = v;
            if (v > 0) heat.push([ci, ri, v]);
          }
        }
        var splitFill = dark ? ["rgba(255,255,255,0.03)", "rgba(255,255,255,0.06)"] : ["rgba(0,0,0,0.02)", "rgba(0,0,0,0.05)"];
        var chart = init("chart-dyad", Object.assign(baseOpt(), {
          animation: false,
          tooltip: { position: "top", formatter: function (p) { var v = p.value[2]; function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); } return esc(ix.aliases[p.value[1]]) + " → " + esc(ix.aliases[p.value[0]]) + ": " + v; } },
          grid: { left: Math.max(dg.leftCat, 80), right: dg.right, top: dg.top, bottom: Math.max(dg.bottom, 72) },
          xAxis: {
            type: "category",
            data: ix.aliases,
            axisLabel: { color: muted, fontSize: dg.fs, rotate: 28, margin: 10 },
            splitArea: { show: true, areaStyle: { color: splitFill } },
          },
          yAxis: {
            type: "category",
            data: ix.aliases,
            inverse: true,
            axisLabel: { color: muted, fontSize: dg.fs },
            splitArea: { show: true, areaStyle: { color: splitFill } },
          },
          visualMap: {
            min: 0,
            max: maxV,
            calculable: true,
            orient: "horizontal",
            left: "center",
            bottom: 0,
            itemHeight: dg.w < 380 ? 72 : 88,
            inRange: { color: [heatLo, dark ? "#2a9d8f" : "#7ecfc2", dark ? "#3ee8c5" : "#0f6b5c", heatHi] },
          },
          series: [{
            type: "heatmap",
            data: heat,
            progressive: 0,
            animation: false,
            label: {
              show: true,
              color: text,
              fontSize: dg.w < 380 ? 8 : 10,
              formatter: function (p) { var v = p.value[2]; return v > 0 ? String(v) : ""; },
            },
            emphasis: {
              label: { show: true, color: text, fontSize: dg.w < 380 ? 9 : 11 },
              itemStyle: { shadowBlur: 12, shadowColor: dark ? "rgba(62,232,197,0.5)" : "rgba(15,107,92,0.35)" },
            },
            itemStyle: { borderWidth: 0 },
          }],
        }));
        if (chart) markDyadReady(el);
        return chart;
      }
      function bootDyadWhenVisible(data) {
        if (!data || !data.interaction || !data.interaction.aliases.length) return;
        var el = document.getElementById("chart-dyad");
        if (!el || dyadChartStarted) return;
        function startDyad() {
          if (dyadChartStarted) return;
          dyadChartStarted = true;
          requestAnimationFrame(function () { initDyadChart(data); });
        }
        if (typeof IntersectionObserver === "undefined") {
          startDyad();
          return;
        }
        var dyIo = new IntersectionObserver(function (entries) {
          if (entries.some(function (e) { return e.isIntersecting; })) {
            dyIo.disconnect();
            startDyad();
          }
        }, { rootMargin: "200px 0px", threshold: 0.05 });
        dyIo.observe(el);
        setTimeout(function () {
          if (dyadChartStarted) return;
          var r = el.getBoundingClientRect();
          if (r.top < window.innerHeight + 200 && r.bottom > 0) startDyad();
        }, 200);
      }
      kcaDyadBoot = bootDyadWhenVisible;
      function resizeAll() {
        charts.forEach(function (c) {
          try { c.resize(); } catch (e) {}
        });
      }
      function layout(el) {
        var w = (el && el.clientWidth) || 400;
        if (w < 380) {
          return { w: w, left: 28, right: 8, top: 14, bottom: 44, fs: 9, rot: 40, leftCat: 56, bottomRot: 42 };
        }
        if (w < 640) {
          return { w: w, left: 40, right: 10, top: 18, bottom: 34, fs: 10, rot: 26, leftCat: 72, bottomRot: 32 };
        }
        return { w: w, left: 48, right: 14, top: 22, bottom: 28, fs: 11, rot: 0, leftCat: 96, bottomRot: 28 };
      }
      function init(id, opt) {
        var el = document.getElementById(id);
        if (!el) return null;
        try {
          var chart = echarts.init(el, null, { renderer: "canvas" });
          chart.setOption(opt);
          charts.push(chart);
          if (typeof ResizeObserver !== "undefined") {
            var ro = new ResizeObserver(function () {
              requestAnimationFrame(function () {
                try { chart.resize(); } catch (e) {}
              });
            });
            ro.observe(el);
          }
          return chart;
        } catch (err) {
          console.error("[kca-chart]", id, err);
          el.setAttribute("data-chart-failed", "1");
          el.innerHTML = '<p style="margin:0;padding:12px;font-size:12px;color:var(--muted);text-align:center">차트를 불러오지 못했어요. 새로고침하거나 네트워크(CDN)를 확인해 주세요.</p>';
          return null;
        }
      }
      var chartHooksInstalled = false;
      var resizeListenersBound = false;
      var kwSortBound = false;

      function paintCharts() {
      dark = isDarkTheme();
      text = cssVar("--ink", dark ? "#e9eef5" : "#141a1f");
      muted = cssVar("--muted", dark ? "#8b98a8" : "#5c6670");
      accent = cssVar("--accent", dark ? "#3ee8c5" : "#0f6b5c");
      accent2 = cssVar("--accent2", dark ? "#818cf8" : "#4f46e5");
      heatLo = cssVar("--chart-heat-lo", dark ? "#1a2744" : "#d4e4f4");
      heatHi = cssVar("--chart-heat-hi", dark ? "#5ee8ff" : "#1e4fd6");
      wdColors = [
        cssVar("--chart-wd-0", dark ? "#818cf8" : "#4f46e5"),
        cssVar("--chart-wd-1", dark ? "#3ee8c5" : "#0f6b5c"),
        cssVar("--chart-wd-2", dark ? "#34d399" : "#059669"),
        cssVar("--chart-wd-3", dark ? "#2dd4bf" : "#0d9488"),
        cssVar("--chart-wd-4", dark ? "#38bdf8" : "#0284c7"),
        cssVar("--chart-wd-5", dark ? "#fbbf24" : "#d97706"),
        cssVar("--chart-wd-6", dark ? "#fb923c" : "#ea580c"),
      ];

      function hourBarColor(h) {
        if (h <= 5) return dark ? "#6366f1" : "#4f46e5";
        if (h <= 11) return dark ? "#3ee8c5" : "#0f6b5c";
        if (h <= 17) return dark ? "#fbbf24" : "#d97706";
        return dark ? "#3b82f6" : "#1d4ed8";
      }
      if (data.hourly && document.getElementById("chart-hours")) {
        var hoursEl = document.getElementById("chart-hours");
        var hg = layout(hoursEl);
        init("chart-hours", Object.assign(baseOpt(), {
          grid: { left: hg.left, right: hg.right, top: hg.top, bottom: hg.bottom },
          xAxis: { type: "category", data: data.hourly.map(function (_, h) { return h + "시"; }), axisLabel: { color: muted, fontSize: hg.fs, rotate: hg.rot, interval: hg.w < 480 ? 2 : 0 } },
          yAxis: { type: "value", axisLabel: { color: muted }, splitLine: { lineStyle: { color: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" } } },
          series: [{
            type: "bar",
            data: data.hourly.map(function (v, h) {
              return { value: v, itemStyle: { color: hourBarColor(h), borderRadius: [4, 4, 0, 0] } };
            }),
            markArea: {
              silent: true,
              itemStyle: { color: dark ? "rgba(99,102,241,0.12)" : "rgba(79,70,229,0.08)" },
              data: [[{ xAxis: "0시" }, { xAxis: "5시" }], [{ xAxis: "22시" }, { xAxis: "23시" }]],
            },
          }],
        }));
      }

      if (data.weekdays && document.getElementById("chart-weekday")) {
        var wdEl = document.getElementById("chart-weekday");
        var wg = layout(wdEl);
        var wdCounts = data.weekdays.map(function (w) { return w.count; });
        var wdMax = Math.max.apply(null, wdCounts.concat([1]));
        init("chart-weekday", Object.assign(baseOpt(), {
          grid: { left: wg.leftCat, right: wg.right, top: wg.top, bottom: wg.bottom },
          xAxis: { type: "value", axisLabel: { color: muted, fontSize: wg.fs } },
          yAxis: { type: "category", data: data.weekdays.map(function (w) { return w.label; }), axisLabel: { color: muted, fontSize: wg.fs } },
          series: [{
            type: "bar",
            data: data.weekdays.map(function (w, i) {
              var c = wdColors[i % 7];
              return {
                value: w.count,
                itemStyle: {
                  color: c,
                  borderRadius: [0, 6, 6, 0],
                  shadowBlur: w.count >= wdMax ? 10 : 0,
                  shadowColor: w.count >= wdMax ? (dark ? "rgba(62,232,197,0.45)" : "rgba(15,107,92,0.35)") : "transparent",
                },
              };
            }),
          }],
        }));
      }

      if (data.monthly && document.getElementById("chart-monthly")) {
        var moEl = document.getElementById("chart-monthly");
        var mg = layout(moEl);
        var monthLabels = data.monthly.map(function (m) {
          if (mg.w < 480) {
            var p = m.label.split("-");
            return p.length >= 2 ? Number(p[1]) + "월" : m.label;
          }
          return m.label;
        });
        init("chart-monthly", Object.assign(baseOpt(), {
          grid: { left: mg.left, right: mg.right, top: mg.top, bottom: mg.bottom },
          xAxis: { type: "category", data: monthLabels, axisLabel: { color: muted, fontSize: mg.fs, rotate: mg.bottomRot } },
          yAxis: { type: "value", axisLabel: { color: muted, fontSize: mg.fs }, splitLine: { lineStyle: { color: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" } } },
          series: [{ type: "line", smooth: true, data: data.monthly.map(function (m) { return m.count; }), areaStyle: { opacity: 0.12 }, lineStyle: { width: 2, color: accent2 }, itemStyle: { color: accent2 } }],
        }));
      }

      if (data.daily && document.getElementById("chart-daily-heat")) {
        var heatEl = document.getElementById("chart-daily-heat");
        var dg = layout(heatEl);
        var heatMax = Math.max.apply(null, data.daily.map(function (d) { return d.count; }).concat([1]));
        var heat = data.daily.map(function (d) { return [d.date, d.count]; });
        var burstSet = {};
        (data.burstDates || []).forEach(function (d) { burstSet[d] = true; });
        var daySpan = data.daily.length;
        var useBarFallback = daySpan > 0 && daySpan < 90;
        if (useBarFallback) {
          var labels = data.daily.map(function (d) {
            var p = d.date.split("-");
            return p.length === 3 ? Number(p[1]) + "/" + Number(p[2]) : d.date;
          });
          init("chart-daily-heat", Object.assign(baseOpt(), {
            grid: { left: dg.left, right: dg.right, top: dg.top, bottom: Math.max(dg.bottom, 52), containLabel: true },
            tooltip: { trigger: "axis" },
            xAxis: { type: "category", data: labels, axisLabel: { color: muted, fontSize: dg.fs, rotate: labels.length > 20 ? 40 : 0, interval: labels.length > 40 ? Math.floor(labels.length / 20) : 0 } },
            yAxis: { type: "value", axisLabel: { color: muted }, splitLine: { lineStyle: { color: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" } } },
            visualMap: { show: false, min: 0, max: heatMax, inRange: { color: dark ? ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"] : ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"] } },
            series: [{
              type: "bar",
              data: data.daily.map(function (d) { return d.count; }),
              itemStyle: { borderRadius: [3, 3, 0, 0], borderWidth: 0 },
              emphasis: { itemStyle: { shadowBlur: 10, shadowColor: dark ? "rgba(62,232,197,0.45)" : "rgba(15,107,92,0.35)" } },
            }],
          }));
        } else {
          var cellH = dg.w < 380 ? 12 : dg.w < 640 ? 14 : 16;
          var cellW = dg.w < 380 ? 12 : 14;
          init("chart-daily-heat", Object.assign(baseOpt(), {
            tooltip: { position: "top" },
            visualMap: { min: 0, max: heatMax, calculable: true, orient: "horizontal", left: "center", bottom: 0, textStyle: { color: muted, fontSize: dg.fs }, itemWidth: dg.w < 380 ? 10 : 14, itemHeight: dg.w < 380 ? 60 : 80, inRange: { color: dark ? ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"] : ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"] } },
            calendar: { top: dg.w < 380 ? 28 : 36, left: dg.left, right: dg.right, cellSize: [cellW, cellH], range: data.daily.length ? [data.daily[0].date, data.daily[data.daily.length - 1].date] : undefined, itemStyle: { borderWidth: 0, borderColor: "transparent" }, dayLabel: { color: muted, fontSize: dg.fs }, monthLabel: { color: muted, fontSize: dg.fs } },
            series: [{ type: "heatmap", coordinateSystem: "calendar", data: heat, emphasis: { itemStyle: { shadowBlur: 8, shadowColor: dark ? "rgba(62,232,197,0.5)" : "rgba(33,110,57,0.45)" } } }],
          }));
        }
      }

      if (data.keywords && document.getElementById("chart-kw-cloud")) {
        var cloudEl = document.getElementById("chart-kw-cloud");
        var cg = layout(cloudEl);
        var cloud = data.keywords.slice(0, 100).map(function (k) {
          return { name: k.label, value: k.count };
        });
        var sizeLo = cg.w < 380 ? 10 : 12;
        var sizeHi = cg.w < 380 ? 34 : cg.w < 640 ? 46 : 56;
        init("chart-kw-cloud", {
          textStyle: baseOpt().textStyle,
          tooltip: { show: true },
          series: [{
            type: "wordCloud",
            shape: "circle",
            gridSize: cg.w < 380 ? 8 : 6,
            sizeRange: [sizeLo, sizeHi],
            rotationRange: [-45, 45],
            textStyle: {
              fontFamily: "Pretendard, Apple SD Gothic Neo, sans-serif",
              color: function () {
                var palette = dark ? ["#3ee8c5", "#818cf8", "#fbbf24", "#fb923c", "#f472b6"] : ["#0f6b5c", "#4f46e5", "#b8860b", "#c45c2a", "#be185d"];
                return palette[Math.floor(Math.random() * palette.length)];
              },
            },
            data: cloud,
          }],
        });
      }

      if (data.sentiment && document.getElementById("chart-sentiment")) {
        var sentEl = document.getElementById("chart-sentiment");
        var sg = layout(sentEl);
        var s = data.sentiment;
        init("chart-sentiment", Object.assign(baseOpt(), {
          tooltip: { trigger: "item", formatter: "{b}: {c}%" },
          legend: { bottom: 0, textStyle: { color: muted, fontSize: sg.fs } },
          series: [{
            type: "pie",
            radius: sg.w < 380 ? ["32%", "58%"] : ["35%", "62%"],
            center: ["50%", "46%"],
            data: [
              { name: "긍정", value: s.positivePercent },
              { name: "중립", value: s.neutralPercent },
              { name: "부정", value: s.negativePercent },
            ],
            label: { color: text, fontSize: sg.fs },
          }],
        }));
      }

      if (data.topicsThemes && data.topicsThemes.length && document.getElementById("chart-topics")) {
        var topEl = document.getElementById("chart-topics");
        var tg = layout(topEl);
        var topics = data.topicsThemes.slice(0, 12);
        init("chart-topics", Object.assign(baseOpt(), {
          grid: { left: Math.max(tg.leftCat, tg.w < 380 ? 72 : 96), right: tg.right, top: tg.top, bottom: tg.bottom },
          xAxis: { type: "value", axisLabel: { color: muted, fontSize: tg.fs, formatter: "{value}%" } },
          yAxis: {
            type: "category",
            data: topics.map(function (t) { return t.title; }).reverse(),
            axisLabel: { color: text, fontSize: tg.fs },
          },
          series: [{
            type: "bar",
            data: topics.map(function (t) { return t.messagePercent; }).reverse(),
            itemStyle: {
              borderRadius: [0, 6, 6, 0],
              color: function (p) { return p.dataIndex % 2 === 0 ? accent : accent2; },
            },
          }],
        }));
      }

      if (data.topicTrend && data.topicTrend.length && document.getElementById("chart-topic-trend")) {
        var ttEl = document.getElementById("chart-topic-trend");
        var tg = layout(ttEl);
        var periods = data.topicTrend.map(function (t) { return t.period; });
        var allNames = [];
        var nameSet = {};
        data.topicTrend.forEach(function (t) {
          t.topics.forEach(function (topic) {
            if (!nameSet[topic.name]) {
              nameSet[topic.name] = true;
              allNames.push(topic.name);
            }
          });
        });
        var series = allNames.map(function (name, idx) {
          return {
            name: name,
            type: "line",
            stack: "Total",
            areaStyle: { opacity: 0.18 },
            lineStyle: { width: 1.5 },
            symbol: "circle",
            symbolSize: 4,
            emphasis: { focus: "series" },
            data: data.topicTrend.map(function (t) {
              var found = t.topics.find(function (topic) { return topic.name === name; });
              return found ? found.value : 0;
            }),
          };
        });
        var ttColors = [
          dark ? "#818cf8" : "#4f46e5",
          dark ? "#3ee8c5" : "#0f6b5c",
          dark ? "#34d399" : "#059669",
          dark ? "#2dd4bf" : "#0d9488",
          dark ? "#38bdf8" : "#0284c7",
          dark ? "#fbbf24" : "#d97706",
          dark ? "#fb923c" : "#ea580c",
          dark ? "#f472b6" : "#be185d",
        ];
        init("chart-topic-trend", Object.assign(baseOpt(), {
          grid: { left: tg.leftCat, right: tg.right, top: tg.top, bottom: Math.max(tg.bottom, 60) },
          tooltip: { trigger: "axis", backgroundColor: dark ? "#1c2128" : "#fff" },
          legend: { type: "scroll", bottom: 0, textStyle: { color: muted, fontSize: tg.fs }, pageIconColor: accent, pageTextStyle: { color: muted } },
          xAxis: { type: "category", data: periods, axisLabel: { color: muted, fontSize: tg.fs } },
          yAxis: { type: "value", axisLabel: { color: muted, fontSize: tg.fs }, splitLine: { lineStyle: { color: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" } } },
          color: ttColors,
          series: series,
        }));
      }

      if (data.domains && document.getElementById("chart-domains")) {
        var domEl = document.getElementById("chart-domains");
        var domg = layout(domEl);
        init("chart-domains", Object.assign(baseOpt(), {
          tooltip: { trigger: "item" },
          series: [{
            type: "treemap",
            data: data.domains.map(function (d) { return { name: d.label, value: d.count }; }),
            label: {
              color: text,
              fontSize: 11,
              formatter: function (p) {
                var name = p.name;
                if (domg.w < 480 && name.length > 12) return name.slice(0, 10) + "...";
                if (name.length > 20) return name.slice(0, 18) + "...";
                return name;
              }
            },
            itemStyle: { borderColor: dark ? "#0d1117" : "#fff", gapWidth: 2 },
          }],
        }));
      }

      if (data.interaction && document.getElementById("chart-network")) {
        var netEl = document.getElementById("chart-network");
        var ng = layout(netEl);
        var ix = data.interaction;
        var aliases = ix.aliases;
        var matrix = ix.matrix;
        var msgCounts = ix.messageCounts || [];

        // 응답 총량(수신+발신) 기준 정렬 — 응답 네트워크에 적합
        var maxNode = 15;
        var replyCounts = aliases.map(function (_, idx) {
          var total = 0;
          for (var ci = 0; ci < matrix.length; ci += 1) {
            total += (matrix[ci] && matrix[ci][idx]) || 0;
            total += (matrix[idx] && matrix[idx][ci]) || 0;
          }
          return total;
        });
        var indices = aliases.map(function (_, i) { return i; })
          .sort(function (a, b) { return (replyCounts[b] || 0) - (replyCounts[a] || 0); })
          .slice(0, maxNode);

        // 모든 엣지 수집 (임계값 없이)
        var allLinks = [];
        var maxLink = 1;
        for (var ri = 0; ri < indices.length; ri += 1) {
          for (var ci = 0; ci < indices.length; ci += 1) {
            if (ri === ci) continue;
            var src = indices[ri];
            var tgt = indices[ci];
            var v = (matrix[src] && matrix[src][tgt]) || 0;
            if (v > 0) {
              if (v > maxLink) maxLink = v;
              allLinks.push({ source: aliases[src], target: aliases[tgt], value: v });
            }
          }
        }

        // 상위 응답 인사이트 생성
        var insightEl = document.getElementById("chart-network-insight");
        if (insightEl) {
          var sortedLinks = allLinks.slice().sort(function (a, b) { return b.value - a.value; });
          function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
          var insightItems = sortedLinks.slice(0, 3).map(function (l) {
            return '<span class="network-insight-item"><strong>' + esc(l.source) + '</strong> <span class="network-arrow">→</span> <strong>' + esc(l.target) + '</strong> <span class="network-count">' + esc(l.value) + '회</span></span>';
          });
          if (insightItems.length > 0) {
            insightEl.innerHTML = '<span class="network-insight-label">💡 상위 응답 흐름</span>' + insightItems.join('<span class="network-insight-sep">·</span>') + '<span class="network-insight-note"> (전체 기준)</span>';
          }
        }

        // 기본 임계값: 데이터 기반 자동 설정 (최대값의 2%, 최소 2)
        var defaultThreshold = Math.max(2, Math.min(10, Math.floor(maxLink * 0.02)));
        var currentThreshold = defaultThreshold;
        var networkChart = null;

        function buildNetworkChart(threshold) {
          // 임계값으로 필터링
          var links = [];
          for (var i = 0; i < allLinks.length; i += 1) {
            if (allLinks[i].value >= threshold) links.push(allLinks[i]);
          }
          // 표시할 상위 N개만 (최대 60개 — 가독성 보장)
          if (links.length > 60) {
            links.sort(function (a, b) { return b.value - a.value; });
            links = links.slice(0, 60);
          }

          var emptyEl = document.getElementById("chart-network-empty");
          if (emptyEl) emptyEl.hidden = links.length > 0 || allLinks.length === 0;

          var isMobile = ng.w < 380;
          var isSmall = ng.w < 600;

          // 노드: 응답 총량 기반 크기, 원형 배치
          var nodes = indices.map(function (idx) {
            var totalReplies = replyCounts[idx] || 0;
            // 면적 인식 고려 sqrt 스케일링, 최소 22px ~ 최대 68px
            var size = Math.max(22, Math.min(68, Math.sqrt(totalReplies + 1) * 3.2));
            return {
              name: aliases[idx],
              value: totalReplies,
              symbolSize: size,
              category: 0,
              label: { show: true }
            };
          });

          if (links.length === 0 && allLinks.length > 0) {
            // 엣지 없으면 노드만 표시 (빈 원형 다이어그램)
            links = [];
          }

          if (nodes.length === 0) return;

          // 엣지 스타일: 비례 두께 + 방향 화살표
          var styledLinks = links.map(function (l) {
            return {
              source: l.source,
              target: l.target,
              value: l.value,
              lineStyle: {
                width: Math.max(1, Math.min(10, (l.value / maxLink) * 8)),
                curveness: 0.3,
                opacity: Math.max(0.2, Math.min(0.8, (l.value / maxLink)))
              }
            };
          });

          // 공통 툴팁·시리즈 설정 (setOption / init 경로 중복 제거)
          var networkTooltip = {
            trigger: "item",
            formatter: function (p) {
              function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
              if (p.dataType === "edge") {
                var arrowColor = dark ? "#5ee8ff" : "#0f6b5c";
                return '<div style="font-weight:600;margin-bottom:4px">' + esc(p.data.source) + ' <span style="color:' + arrowColor + '">→</span> ' + esc(p.data.target) + '</div><div>응답: <strong>' + p.data.value + '회</strong></div>';
              }
              var idx = aliases.indexOf(p.data.name);
              if (idx < 0) idx = 0;
              return '<div style="font-weight:600;margin-bottom:4px">' + esc(p.data.name) + '</div><div>메시지: <strong>' + (msgCounts[idx] || 0) + '건</strong></div><div>응답 총량: <strong>' + (replyCounts[idx] || 0) + '회</strong></div>';
            }
          };
          var networkSeries = {
            type: "graph",
            layout: "circular",
            circular: { rotateLabel: false },
            data: nodes,
            links: styledLinks,
            roam: isMobile ? false : "scale",
            draggable: false,
            edgeSymbol: ["none", "arrow"],
            edgeSymbolSize: [0, isMobile ? 6 : 9],
            symbol: "circle",
            itemStyle: {
              borderColor: dark ? "#1c2128" : "#fff",
              borderWidth: 2,
              color: dark ? "#5ee8ff" : "#0f6b5c"
            },
            label: {
              show: true,
              position: "right",
              color: text,
              fontSize: isMobile ? 9 : (isSmall ? 10 : 11),
              fontWeight: 600,
              distance: 8,
              formatter: function (p) {
                var name = p.name;
                if (isMobile && name.length > 5) return name.slice(0, 4) + "..";
                if (isSmall && name.length > 7) return name.slice(0, 6) + "..";
                if (name.length > 10) return name.slice(0, 8) + "..";
                return name;
              }
            },
            labelLayout: { hideOverlap: true },
            lineStyle: {
              color: dark ? "rgba(94,232,255,0.5)" : "rgba(15,107,92,0.45)",
              curveness: 0.3,
              opacity: 0.55
            },
            emphasis: {
              focus: "adjacency",
              scale: 1.4,
              label: { fontSize: isMobile ? 11 : 13, fontWeight: 700 },
              itemStyle: { shadowBlur: 18, shadowColor: dark ? "rgba(94,232,255,0.45)" : "rgba(15,107,92,0.3)" },
              lineStyle: { width: 5, opacity: 1 }
            },
            blur: {
              itemStyle: { opacity: 0.12 },
              lineStyle: { opacity: 0.04 },
              label: { opacity: 0.15 }
            }
          };

          if (networkChart) {
            networkChart.setOption(Object.assign(baseOpt(), {
              animation: false,
              animationDuration: 600,
              animationEasing: "cubicOut",
              tooltip: networkTooltip,
              series: [networkSeries]
            }), { notMerge: false });
          } else {
            networkChart = init("chart-network", Object.assign(baseOpt(), {
              animation: true,
              animationDuration: 600,
              animationEasing: "cubicOut",
              tooltip: networkTooltip,
              series: [networkSeries]
            }));
          }
        }

        // 초기 렌더링
        buildNetworkChart(currentThreshold);

        // 임계값 슬라이더 바인딩
        var thresholdSlider = document.getElementById("network-threshold");
        var thresholdVal = document.getElementById("network-threshold-val");
        if (thresholdSlider && thresholdVal) {
          thresholdSlider.value = String(defaultThreshold);
          thresholdVal.textContent = String(defaultThreshold);
          thresholdSlider.addEventListener("input", function () {
            var val = parseInt(this.value, 10);
            thresholdVal.textContent = String(val);
          });
          thresholdSlider.addEventListener("change", function () {
            var val = parseInt(this.value, 10);
            currentThreshold = val;
            buildNetworkChart(val);
          });
        }
      }

      kcaDyadBoot(data);
      }

      function bindKwSortOnce() {
        if (kwSortBound) return;
        var freqEl = document.getElementById("kw-ranked-freq");
        var distEl = document.getElementById("kw-ranked-distinct");
        if (!freqEl || !distEl) return;
        kwSortBound = true;
        var listF = data.keywords || [];
        var listD = data.keywordsDistinctive || listF;
        document.querySelectorAll("[data-kw-sort]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var mode = btn.getAttribute("data-kw-sort");
            document.querySelectorAll("[data-kw-sort]").forEach(function (b) {
              var on = b === btn;
              b.classList.toggle("is-active", on);
              b.setAttribute("aria-pressed", on ? "true" : "false");
            });
            freqEl.hidden = mode !== "freq";
            distEl.hidden = mode !== "distinct";
            var src = mode === "distinct" ? listD : listF;
            var cloudEl = document.getElementById("chart-kw-cloud");
            if (cloudEl && typeof echarts !== "undefined") {
              var inst = echarts.getInstanceByDom(cloudEl);
              if (inst) {
                inst.setOption({
                  series: [{
                    data: src.slice(0, 100).map(function (k) { return { name: k.label, value: k.count }; }),
                  }],
                });
              }
            }
          });
        });
      }

      function installChartHooks() {
        if (chartHooksInstalled) return;
        chartHooksInstalled = true;
        function onThemeChange() {
          disposeCharts();
          paintCharts();
        }
        var themeObs = new MutationObserver(function () { setTimeout(onThemeChange, 60); });
        themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        var mqOsTheme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
        function onOsThemeChange() {
          if (document.documentElement.getAttribute("data-theme")) return;
          onThemeChange();
        }
        if (mqOsTheme && mqOsTheme.addEventListener) {
          mqOsTheme.addEventListener("change", onOsThemeChange);
        } else if (mqOsTheme && mqOsTheme.addListener) {
          mqOsTheme.addListener(onOsThemeChange);
        }
        var mqWide = window.matchMedia && window.matchMedia("(min-width: 900px)");
        if (mqWide && mqWide.addEventListener) {
          mqWide.addEventListener("change", function () { setTimeout(resizeAll, 80); });
        } else if (mqWide && mqWide.addListener) {
          mqWide.addListener(function () { setTimeout(resizeAll, 80); });
        }
      }

      paintCharts();
      installChartHooks();
      bindKwSortOnce();
      if (!resizeListenersBound) {
        resizeListenersBound = true;
        requestAnimationFrame(resizeAll);
        setTimeout(resizeAll, 150);
        window.addEventListener("resize", resizeAll);
        window.addEventListener("load", resizeAll);
      }
      }
      function whenVisible() {
        var anchor = document.getElementById("s-viz") || document.querySelector(".chart-box");
        if (!anchor || typeof IntersectionObserver === "undefined") {
          run();
          return;
        }
        var started = false;
        var io = new IntersectionObserver(function (entries) {
          if (started) return;
          if (entries.some(function (e) { return e.isIntersecting; })) {
            started = true;
            io.disconnect();
            run();
          }
        }, { rootMargin: "480px 0px", threshold: 0.01 });
        io.observe(anchor);
        setTimeout(function () {
          if (started) return;
          var r = anchor.getBoundingClientRect();
          if (r.top < window.innerHeight + 320) {
            started = true;
            io.disconnect();
            run();
          }
        }, 200);
        setTimeout(function () {
          if (started) return;
          started = true;
          try { io.disconnect(); } catch (e) {}
          run();
        }, 300);
      }
      function bootCharts() {
        if (typeof echarts === "undefined") return false;
        whenVisible();
        return true;
      }
      if (!bootCharts()) {
        window.addEventListener("load", function () {
          var tries = 0;
          (function wait() {
            if (bootCharts()) return;
            if (++tries > 120) {
              document.querySelectorAll(".chart-box").forEach(function (el) {
                if (!el.querySelector("canvas")) {
                  el.innerHTML = '<p style="margin:0;padding:12px;font-size:12px;color:var(--muted);text-align:center">ECharts CDN을 불러오지 못했습니다.</p>';
                }
              });
              return;
            }
            setTimeout(wait, 50);
          })();
        });
      }
    })();
`;
