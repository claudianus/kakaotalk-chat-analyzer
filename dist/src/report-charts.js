import { escapeHtml, formatNumber } from "./report-util.js";
/** head: CDN preconnect만 (스크립트는 body 끝에서 동기 로드) */
export const CHART_CDN_HEAD = `
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
`;
/** body 끝: 차트 라이브러리 — defer 금지(인라인 init보다 반드시 먼저 실행) */
export const CHART_CDN_BODY = `
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/echarts-wordcloud@2.1.0/dist/echarts-wordcloud.min.js"></script>
`;
export const REPORT_VIZ_CSS = `
    .viz-hero {
      margin: 0 0 18px;
      padding: 20px 22px;
      border-radius: 20px;
      border: 1px solid var(--glass-border);
      background: var(--glass);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      box-shadow: var(--shadow);
    }
    .viz-hero h2 {
      margin: 0 0 6px;
      font-size: 22px;
      font-weight: 850;
      letter-spacing: -0.03em;
      background: var(--accent-grad);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .viz-hero p { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.55; }
    .viz-grid {
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(12, 1fr);
    }
    .viz-card {
      grid-column: span 12;
      border-radius: 18px;
      border: 1px solid var(--glass-border);
      background: var(--glass);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      padding: 16px 16px 12px;
      box-shadow: var(--shadow);
    }
    @media (min-width: 900px) {
      .viz-card.span-6 { grid-column: span 6; }
      .viz-card.span-8 { grid-column: span 8; }
      .viz-card.span-4 { grid-column: span 4; }
    }
    .viz-card h3 {
      margin: 0 0 4px;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .viz-card .viz-hint {
      margin: 0 0 10px;
      font-size: 11px;
      color: var(--muted);
      line-height: 1.45;
    }
    .chart-box {
      width: 100%;
      min-height: 280px;
      height: min(42vh, 360px);
    }
    .chart-box.tall { height: min(52vh, 440px); min-height: 320px; }
    .chart-box.compact { height: 240px; min-height: 220px; }
    .kw-table-wrap {
      max-height: 520px;
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 12px;
    }
    .kw-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .kw-table thead th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: var(--panel-solid);
      text-align: left;
      padding: 8px 10px;
      font-size: 11px;
      color: var(--muted);
      border-bottom: 1px solid var(--line);
    }
    .kw-table td {
      padding: 7px 10px;
      border-bottom: 1px solid var(--line);
    }
    .kw-table tbody tr:nth-child(even) { background: rgba(94, 234, 212, 0.04); }
    .kw-table .num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 650; }
    .kw-rank { color: var(--muted); width: 2.5rem; }
`;
export function serializeChartPayload(data) {
    return JSON.stringify(buildChartPayload(data))
        .replace(/</g, "\\u003c")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
}
export function buildChartPayload(data) {
    return {
        hourly: data.hourly,
        weekdays: data.weekdays,
        monthly: data.monthly.map((m) => ({ label: m.date, count: m.count })),
        daily: data.daily,
        keywords: data.keywords,
        domains: data.domains.slice(0, 24),
        participants: data.participants.slice(0, 24).map((p) => ({
            alias: p.alias,
            messages: p.messages,
            sharePercent: p.sharePercent,
        })),
        calendarCells: data.story.calendarWeeks
            .flatMap((w) => w.cells)
            .filter((c) => c.date && c.count > 0)
            .map((c) => ({ date: c.date, count: c.count })),
        burstDates: data.burstDays.map((b) => b.date),
        totalParticipants: data.participants.length,
    };
}
export function renderChartDeck(data) {
    const kw = data.keywords.length;
    const showLegacyDaily = data.story.calendarWeeks.length === 0 && data.daily.length > 0;
    return `<section id="s-viz" class="viz-hero anim-enter" style="--enter-delay:0.055s" aria-label="인터랙티브 차트">
    <h2>📊 인터랙티브 차트</h2>
    <p>ECharts 기반 — 막대·히트맵·워드클라우드에 마우스를 올리면 수치를 확인할 수 있어요. 키워드 <strong>${formatNumber(kw)}</strong>개(메시지 등장 횟수 기준).</p>
  </section>
  <div class="viz-grid anim-enter" style="--enter-delay:0.06s">
    <article class="viz-card span-8">
      <h3>키워드 워드클라우드</h3>
      <p class="viz-hint">글자 크기 = 메시지 등장 빈도. KR-WordRank로 뽑은 본문 어절입니다.</p>
      <div id="chart-kw-cloud" class="chart-box tall" role="img" aria-label="키워드 워드클라우드"></div>
    </article>
    <article class="viz-card span-4">
      <h3>시간대 분포</h3>
      <p class="viz-hint">0~23시 메시지량</p>
      <div id="chart-hours" class="chart-box compact" role="img" aria-label="시간대 차트"></div>
    </article>
    <article class="viz-card span-6">
      <h3>일별 활동 히트맵</h3>
      <p class="viz-hint">활동 기간만 표시 · 급증일 강조</p>
      <div id="chart-daily-heat" class="chart-box" role="img" aria-label="일별 히트맵"></div>
    </article>
    <article class="viz-card span-6">
      <h3>요일 분포</h3>
      <p class="viz-hint">요일별 메시지량</p>
      <div id="chart-weekday" class="chart-box compact" role="img" aria-label="요일 차트"></div>
      <h3 style="margin-top:14px">월별 추이</h3>
      <p class="viz-hint">월 단위 합계</p>
      <div id="chart-monthly" class="chart-box compact" role="img" aria-label="월별 차트"></div>
    </article>
    <article class="viz-card span-12">
      <h3>키워드 상위 ${formatNumber(Math.min(kw, 80))} · 메시지 등장 횟수</h3>
      <p class="viz-hint">막대는 실제로 해당 단어가 포함된 메시지 수입니다. 아래 표에서 전체 ${formatNumber(kw)}개를 볼 수 있어요.</p>
      <div id="chart-kw-bar" class="chart-box tall" role="img" aria-label="키워드 막대 차트"></div>
      ${renderKeywordTable(data.keywords)}
    </article>
    <article class="viz-card span-6">
      <h3>참여자 상위</h3>
      <p class="viz-hint">전체 ${formatNumber(data.participants.length)}명 중 상위 24명</p>
      <div id="chart-participants" class="chart-box" role="img" aria-label="참여자 차트"></div>
    </article>
    <article class="viz-card span-6">
      <h3>공유 도메인</h3>
      <p class="viz-hint">링크 호스트 상위</p>
      <div id="chart-domains" class="chart-box" role="img" aria-label="도메인 차트"></div>
    </article>
  </div>
  ${showLegacyDaily ? "" : "<!-- legacy daily heatmap omitted when story calendar exists -->"}`;
}
function renderKeywordTable(items) {
    if (items.length === 0)
        return "";
    const rows = items
        .map((item, i) => `<tr><td class="kw-rank num">${i + 1}</td><td>${escapeHtml(item.label)}</td><td class="num">${formatNumber(item.count)}</td></tr>`)
        .join("");
    return `<div class="kw-table-wrap" style="margin-top:12px"><table class="kw-table"><thead><tr><th>#</th><th>키워드</th><th class="num">메시지 수</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
export const CHARTS_INIT_SCRIPT = `
    (function () {
      function run() {
      var dataEl = document.getElementById("kca-chart-data");
      if (!dataEl) return;
      if (typeof echarts === "undefined") return;
      var data;
      try { data = JSON.parse(dataEl.textContent || "{}"); } catch (e) { return; }

      var dark = document.documentElement.getAttribute("data-theme") === "dark" ||
        (!document.documentElement.getAttribute("data-theme") &&
          window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
      var text = dark ? "#e9eef5" : "#141a1f";
      var muted = dark ? "#8b98a8" : "#5c6670";
      var accent = dark ? "#3ee8c5" : "#0f6b5c";
      var accent2 = dark ? "#818cf8" : "#4f46e5";

      function baseOpt() {
        return {
          textStyle: { color: text, fontFamily: "Pretendard, Apple SD Gothic Neo, sans-serif" },
          tooltip: { trigger: "axis", backgroundColor: dark ? "#1c2128" : "#fff", borderColor: "transparent" },
        };
      }

      function init(id, opt) {
        var el = document.getElementById(id);
        if (!el) return;
        try {
          var chart = echarts.init(el, null, { renderer: "canvas" });
          chart.setOption(opt);
          window.addEventListener("resize", function () { chart.resize(); });
        } catch (err) {
          console.error("[kca-chart]", id, err);
        }
      }

      if (data.hourly && document.getElementById("chart-hours")) {
        init("chart-hours", Object.assign(baseOpt(), {
          grid: { left: 36, right: 12, top: 24, bottom: 28 },
          xAxis: { type: "category", data: data.hourly.map(function (_, h) { return h + "시"; }), axisLabel: { color: muted, fontSize: 10 } },
          yAxis: { type: "value", axisLabel: { color: muted }, splitLine: { lineStyle: { color: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" } } },
          series: [{
            type: "bar",
            data: data.hourly,
            itemStyle: {
              borderRadius: [4, 4, 0, 0],
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: accent },
                { offset: 1, color: accent2 },
              ]),
            },
          }],
        }));
      }

      if (data.weekdays && document.getElementById("chart-weekday")) {
        init("chart-weekday", Object.assign(baseOpt(), {
          grid: { left: 48, right: 12, top: 24, bottom: 28 },
          xAxis: { type: "value", axisLabel: { color: muted } },
          yAxis: { type: "category", data: data.weekdays.map(function (w) { return w.label; }), axisLabel: { color: muted } },
          series: [{ type: "bar", data: data.weekdays.map(function (w) { return w.count; }), itemStyle: { color: accent, borderRadius: [0, 6, 6, 0] } }],
        }));
      }

      if (data.monthly && document.getElementById("chart-monthly")) {
        init("chart-monthly", Object.assign(baseOpt(), {
          grid: { left: 40, right: 12, top: 20, bottom: 36 },
          xAxis: { type: "category", data: data.monthly.map(function (m) { return m.label; }), axisLabel: { color: muted, fontSize: 10, rotate: 35 } },
          yAxis: { type: "value", axisLabel: { color: muted }, splitLine: { lineStyle: { color: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" } } },
          series: [{ type: "line", smooth: true, data: data.monthly.map(function (m) { return m.count; }), areaStyle: { opacity: 0.12 }, lineStyle: { width: 2, color: accent2 }, itemStyle: { color: accent2 } }],
        }));
      }

      if (data.daily && document.getElementById("chart-daily-heat")) {
        var heat = data.daily.map(function (d) { return [d.date, d.count]; });
        var burst = {};
        (data.burstDates || []).forEach(function (d) { burst[d] = true; });
        init("chart-daily-heat", Object.assign(baseOpt(), {
          tooltip: { position: "top" },
          visualMap: { min: 0, max: Math.max.apply(null, data.daily.map(function (d) { return d.count; })), calculable: true, orient: "horizontal", left: "center", bottom: 0, textStyle: { color: muted }, inRange: { color: dark ? ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"] : ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"] } },
          calendar: { top: 36, left: 40, right: 20, cellSize: ["auto", 14], range: data.daily.length ? [data.daily[0].date, data.daily[data.daily.length - 1].date] : undefined, itemStyle: { borderWidth: 0.5, borderColor: dark ? "#30363d" : "#fff" }, dayLabel: { color: muted, fontSize: 10 }, monthLabel: { color: muted } },
          series: [{ type: "heatmap", coordinateSystem: "calendar", data: heat }],
        }));
      }

      if (data.keywords && document.getElementById("chart-kw-bar")) {
        var topBar = data.keywords.slice(0, 80);
        init("chart-kw-bar", Object.assign(baseOpt(), {
          grid: { left: 96, right: 16, top: 12, bottom: 12 },
          xAxis: { type: "value", axisLabel: { color: muted } },
          yAxis: { type: "category", data: topBar.map(function (k) { return k.label; }).reverse(), axisLabel: { color: text, fontSize: 11 } },
          series: [{ type: "bar", data: topBar.map(function (k) { return k.count; }).reverse(), itemStyle: { color: accent2, borderRadius: [0, 4, 4, 0] } }],
        }));
      }

      if (data.keywords && document.getElementById("chart-kw-cloud") && typeof echarts.graphic !== "undefined") {
        var cloud = data.keywords.slice(0, 100).map(function (k) {
          return { name: k.label, value: k.count };
        });
        init("chart-kw-cloud", {
          textStyle: baseOpt().textStyle,
          tooltip: { show: true },
          series: [{
            type: "wordCloud",
            shape: "circle",
            gridSize: 6,
            sizeRange: [12, 56],
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

      if (data.participants && document.getElementById("chart-participants")) {
        var p = data.participants.slice(0, 16);
        init("chart-participants", Object.assign(baseOpt(), {
          tooltip: { trigger: "item" },
          series: [{
            type: "pie",
            radius: ["42%", "70%"],
            data: p.map(function (x) { return { name: x.alias, value: x.messages }; }),
            label: { color: text, fontSize: 10 },
            itemStyle: { borderRadius: 4, borderColor: dark ? "#0d1117" : "#fff", borderWidth: 2 },
          }],
        }));
      }

      if (data.domains && document.getElementById("chart-domains")) {
        init("chart-domains", Object.assign(baseOpt(), {
          tooltip: { trigger: "item" },
          series: [{
            type: "treemap",
            data: data.domains.map(function (d) { return { name: d.label, value: d.count }; }),
            label: { color: text, fontSize: 11 },
            itemStyle: { borderColor: dark ? "#0d1117" : "#fff", gapWidth: 2 },
          }],
        }));
      }
      }
      if (typeof echarts !== "undefined") {
        run();
      } else {
        window.addEventListener("load", function () {
          var tries = 0;
          (function wait() {
            if (typeof echarts !== "undefined") { run(); return; }
            if (++tries > 120) return;
            setTimeout(wait, 50);
          })();
        });
      }
    })();
`;
//# sourceMappingURL=report-charts.js.map